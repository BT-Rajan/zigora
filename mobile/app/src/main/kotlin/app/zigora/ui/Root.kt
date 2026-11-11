package app.zigora.ui

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.Modifier
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.net.toUri
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.automirrored.outlined.TrendingUp
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffoldDefaults
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteType
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfo
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import app.zigora.Incoming
import app.zigora.AnswerWatch
import app.zigora.ClassAlarms
import app.zigora.R
import app.zigora.data.Me
import app.zigora.data.json
import kotlinx.serialization.Serializable
import kotlinx.coroutines.launch
import kotlinx.serialization.json.put

@Serializable object HomeR
@Serializable object CoursesR
@Serializable data class SearchR(val q: String = "")
@Serializable object MeR
@Serializable data class CourseR(val id: Int)
@Serializable data class TopicR(val id: Int)
@Serializable data class LearnR(val id: Int)  // a topic one step per screen
@Serializable data class QuizR(val id: Int)
@Serializable data class PhotoR(val uri: String = "")
@Serializable object NotesR
@Serializable data class ReaderR(val id: Int)
@Serializable data class DiagramR(val url: String)
@Serializable data class QuestionR(val id: Int)
@Serializable object JoinR
@Serializable data class StudyQuizR(val id: Int, val topic: Int = 0, val own: Int = 0)  // topic: a college topic's practice; own: a topic of the student's own course
@Serializable object StudyR
@Serializable data class StudyCourseR(val id: Int)
@Serializable data class StudyWizardR(val id: Int)
@Serializable data class StudyTopicR(val id: Int)
@Serializable data class MaterialR(val cid: Int, val name: String = "")
@Serializable object PasswordR
@Serializable object KeyR
@Serializable object SavedR
@Serializable object ProgressR
@Serializable object RoutineR
@Serializable object CalendarR
@Serializable data class ScoreCourseR(val cid: Int)
@Serializable data class AttemptsR(val quiz: Int)
@Serializable data class AttemptR(val id: Int)
@Serializable data class RevisionR(val uid: Int)
@Serializable data class McqR(val topic: Int = 0)  // MCQ practice; a topic for the Per topic way in
@Serializable data class McqSetR(val id: Int)

@Composable
fun ZigoraRoot(incoming: Incoming?, handled: () -> Unit) {
    val app = app(); val out by app.signedOut.collectAsState()
    var wallpaper by remember { mutableStateOf(app.store.wallpaper) }
    var theme by remember { mutableStateOf(app.store.theme) }
    var firstOpen by remember { mutableStateOf<String?>(null) }  // after the profile step: "me" to get Pro, "key" to add an own key
    var me by remember(out) { mutableStateOf(app.store.userJson?.let { runCatching { json.decodeFromString(Me.serializer(), it) }.getOrNull() }.takeIf { app.store.token != null }) }
    ZigoraTheme(wallpaper, theme) {
        val user = me
        if (user == null || user.role != "student" || user.must_change || user.profile_needed) LaunchedEffect(Unit) { app.firstScreenReady.value = true }  // Home says so itself, once it has loaded
        when {
            user == null -> SignIn { m -> app.store.userJson = json.encodeToString(Me.serializer(), m); me = m }
            user.role == "guardian" && user.relation == "teacher" -> StaffMain(user, incoming, handled) { app.store.signOut(); app.api.forget(); AnswerWatch.schedule(app, false); ClassAlarms.clear(app); me = null }  // a school teacher: their students and the teacher's pages
            user.role == "guardian" -> GuardianHome(user) { app.store.signOut(); me = null }  // a parent: their children
            user.role != "student" -> StaffMain(user, incoming, handled) { app.store.signOut(); app.api.forget(); AnswerWatch.schedule(app, false); ClassAlarms.clear(app); me = null }  // teachers: questions, classes, struggles
            user.must_change -> ChangePassword(forced = true) { me = user.copy(must_change = false).also { app.store.userJson = json.encodeToString(Me.serializer(), it) } }
            user.profile_needed -> ProfileSetup(user) { m, next -> app.store.userJson = json.encodeToString(Me.serializer(), m); firstOpen = next; me = m }
            else -> Main(user, incoming, handled, firstOpen, { firstOpen = null }, wallpaper = { wallpaper = it; app.store.wallpaper = it }, theme = { theme = it; app.store.theme = it }) {
                app.store.signOut(); app.api.forget(); AnswerWatch.schedule(app, false); ClassAlarms.clear(app); me = null }
        }
        CrashNote()
    }
}

private data class Tab(val route: Any, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

@Composable
private fun Main(me: Me, incoming: Incoming?, handled: () -> Unit, firstOpen: String?, opened: () -> Unit, wallpaper: (Boolean) -> Unit, theme: (String) -> Unit, signOut: () -> Unit) {
    val nav = rememberNavController()
    LaunchedEffect(firstOpen) { when (firstOpen) { "me" -> nav.navigate(MeR); "key" -> nav.navigate(KeyR); else -> return@LaunchedEffect }; opened() }  // the plan they picked in the profile step
    // the web's menu for students (My courses, Saved, My progress) with Home and the account; search sits at the top, as in the web's header
    // short labels, so five fit on any phone at any text size; the screens themselves carry the web's full titles
    // three tabs at the bottom; everything else is in the drawer, which the app's logo (top left) or a swipe from the left edge opens
    val tabs = listOf(Tab(HomeR, stringResource(R.string.tab_home), Icons.Outlined.Home), Tab(CoursesR, stringResource(R.string.tab_courses), Icons.AutoMirrored.Outlined.MenuBook),
                      Tab(MeR, stringResource(R.string.tab_me), Icons.Outlined.AccountCircle))
    val menu = listOf(Tab(HomeR, stringResource(R.string.tab_home), Icons.Outlined.Home), Tab(CoursesR, tl("Choose a course"), Icons.AutoMirrored.Outlined.MenuBook),
                      Tab(JoinR, tl("Join a course"), Icons.Outlined.Add), Tab(StudyR, tl("Build a course"), Icons.Outlined.AutoStories),
                      Tab(McqR(), tl("MCQ practice"), Icons.Outlined.Checklist), Tab(CalendarR, tl("Calendar"), Icons.Outlined.CalendarMonth),
                      Tab(ClassesR, tl("Classes and announcements"), Icons.Outlined.Campaign), Tab(SavedR, stringResource(R.string.tab_saved), Icons.Outlined.BookmarkBorder),
                      Tab(ProgressR, tl("My progress"), Icons.AutoMirrored.Outlined.TrendingUp), Tab(RoutineR, tl("My routine"), Icons.Outlined.Schedule),
                      Tab(NotesR, tl("Notifications"), Icons.Outlined.Notifications), Tab(MeR, stringResource(R.string.tab_me), Icons.Outlined.AccountCircle))
    val drawer = androidx.compose.material3.rememberDrawerState(androidx.compose.material3.DrawerValue.Closed); val dscope = androidx.compose.runtime.rememberCoroutineScope()
    val entry by nav.currentBackStackEntryAsState(); val dest = entry?.destination
    val ctx0 = androidx.compose.ui.platform.LocalContext.current
    LaunchedEffect(me.id) { AnswerWatch.schedule(ctx0, true) }  // a note when a teacher answers
    LaunchedEffect(incoming) {
        when (incoming) {
            is Incoming.Lookup -> nav.navigate(SearchR(incoming.text))
            is Incoming.Photo -> nav.navigate(PhotoR(incoming.uri?.toString().orEmpty()))
            is Incoming.Question -> nav.navigate(QuestionR(incoming.id))
            is Incoming.Classes -> nav.navigate(ClassesR)
            null -> return@LaunchedEffect
        }
        handled()
    }
    val snackState = remember { androidx.compose.material3.SnackbarHostState() }; val snackScope = androidx.compose.runtime.rememberCoroutineScope()
    val snack = remember { Snack(snackState, snackScope) }
    androidx.compose.runtime.CompositionLocalProvider(LocalMe provides me, LocalSnack provides snack, LocalDrawer provides { dscope.launch { drawer.open() }; Unit }) {
    // the reader and a diagram take the whole screen: no tabs under them, so they read as full screen; Close brings the tabs back
    val full = dest?.hasRoute(ReaderR::class) == true || dest?.hasRoute(DiagramR::class) == true || dest?.hasRoute(LearnR::class) == true
    androidx.compose.material3.ModalNavigationDrawer(drawerState = drawer, gesturesEnabled = !full || drawer.isOpen, drawerContent = {
        androidx.compose.material3.ModalDrawerSheet { androidx.compose.foundation.layout.Column(Modifier.verticalScroll(androidx.compose.foundation.rememberScrollState())) {
            androidx.compose.foundation.layout.Row(Modifier.padding(horizontal = 24.dp, vertical = 20.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(R.drawable.ic_logo), null, Modifier.size(36.dp))
                androidx.compose.foundation.layout.Column(Modifier.padding(start = 12.dp)) { Text("Zigora", style = MaterialTheme.typography.titleMedium); Text(me.name, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            if (drawer.isOpen || drawer.targetValue == androidx.compose.material3.DrawerValue.Open) menu.forEach { t ->  // only while it shows: a closed drawer holds nothing
                androidx.compose.material3.NavigationDrawerItem(label = { Text(t.label) }, icon = { Icon(t.icon, null) }, selected = dest?.hasRoute(t.route::class) == true,
                    modifier = Modifier.padding(horizontal = 12.dp),
                    onClick = { dscope.launch { drawer.close() }; nav.navigate(t.route) { popUpTo(nav.graph.findStartDestination().id) { saveState = true }; launchSingleTop = true; restoreState = true } })
            }
        } }
    }) {
    NavigationSuiteScaffold(layoutType = if (full) NavigationSuiteType.None else NavigationSuiteScaffoldDefaults.navigationSuiteType(currentWindowAdaptiveInfo()), navigationSuiteItems = {
        tabs.forEach { t ->
            item(selected = dest?.hasRoute(t.route::class) == true, icon = { Icon(t.icon, null) }, label = { Text(t.label, maxLines = 1, softWrap = false, autoSize = androidx.compose.foundation.text.TextAutoSize.StepBased(minFontSize = 9.sp, maxFontSize = 12.sp)) },
                 onClick = { nav.navigate(t.route) { popUpTo(nav.graph.findStartDestination().id) { saveState = true }; launchSingleTop = true; restoreState = true } })
        }
    }) {
        val open = { id: Int -> nav.navigate(LearnR(id)) }  // a topic opens one step per screen; its full page is a tap away
        val search = { nav.navigate(SearchR()) }
        val scope = androidx.compose.runtime.rememberCoroutineScope(); val a = api(); val toast = rememberToast()
        val ownTopic = { cid: Int, tid: Int -> nav.navigate(StudyCourseR(cid)); nav.navigate(StudyTopicR(tid)) }
        val review = { cid: Int -> scope.launch {  // a review set from the student's own earlier questions
            try { val q = a.send("POST", "/study/courses/$cid/review", null, app.zigora.data.StudyQuiz.serializer()).id; onMain { nav.navigate(StudyQuizR(q)) } } catch (e: Exception) { toast(e.message.orEmpty()) }
        }; Unit }
        val session = { x: app.zigora.data.SessionItem -> when {
            x.kind == "review" -> x.course_id?.let { review(it) } ?: Unit
            x.src == "study" -> x.course_id?.let { ownTopic(it, x.id) } ?: nav.navigate(StudyTopicR(x.id))
            else -> open(x.id)
        } }
        androidx.compose.foundation.layout.Box(Modifier.fillMaxSize()) { androidx.compose.foundation.layout.Column {
            val net = app().api
            LaunchedEffect(net.unreachable.value) { if (net.unreachable.value) { kotlinx.coroutines.delay(8_000); net.unreachable.value = false } }  // a failed request: the note fades
            val note = when {
                net.offline.value -> tl("Offline. Showing what you read before.")
                net.unreachable.value -> tl("No connection. Practice, quizzes and new AI answers need the internet; topics you have opened before still work.")
                net.slow.value -> tl("Taking longer than usual. Your connection may be slow; please wait.")
                else -> null
            }
            if (note != null) Text(note, style = MaterialTheme.typography.labelMedium, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.tertiaryContainer).statusBarsPadding().padding(vertical = 6.dp, horizontal = 16.dp))
        NavHost(nav, startDestination = HomeR, modifier = Modifier.weight(1f)) {
            composable<HomeR> { HomeScreen(me, openTopic = open, openCourse = { nav.navigate(CourseR(it)) }, openQuiz = { nav.navigate(QuizR(it)) },
                                           openNotes = { nav.navigate(NotesR) }, openPhoto = { nav.navigate(PhotoR()) }, openSearch = search,
                                           openRoutine = { nav.navigate(RoutineR) }, openSession = session, openStudy = { nav.navigate(StudyR) }, openMcq = { nav.navigate(McqR()) }, openCalendar = { nav.navigate(CalendarR) }, openProgress = { nav.navigate(ProgressR) }, openPlan = { nav.navigate(MeR) }, openClasses = { nav.navigate(ClassesR) }, openJoin = { nav.navigate(JoinR) },
                                           openOwn = ownTopic, review = review, openSet = { nav.navigate(McqSetR(it)) }) }
            composable<CoursesR> { CoursesScreen(me, search, openStudy = { nav.navigate(StudyR) }, openJoin = { nav.navigate(JoinR) }) { nav.navigate(CourseR(it)) } }
            composable<StudyR> { StudyHomeScreen(back = { nav.popBackStack() }, open = { id, wizard -> nav.navigate(if (wizard) StudyWizardR(id) else StudyCourseR(id)) },
                                                 openTopic = ownTopic, review = review) }
            composable<StudyWizardR> { e -> val id = e.toRoute<StudyWizardR>().id
                StudyWizardScreen(id, back = { nav.popBackStack() }) { nav.navigate(StudyCourseR(id)) { popUpTo<StudyWizardR> { inclusive = true } } } }
            composable<StudyCourseR> { e -> val id = e.toRoute<StudyCourseR>().id
                StudyCourseScreen(id, back = { nav.popBackStack() }, setup = { nav.navigate(StudyWizardR(id)) { popUpTo<StudyCourseR> { inclusive = true } } },
                                  openTopic = { nav.navigate(StudyTopicR(it)) }, review = { q -> nav.navigate(StudyQuizR(q.id)) }) }
            composable<StudyTopicR> { e -> val id = e.toRoute<StudyTopicR>().id
                StudyTopicScreen(id, back = { nav.popBackStack() }, go = { t -> nav.navigate(StudyTopicR(t)) { popUpTo<StudyTopicR> { inclusive = true } } },
                                 quiz = { q -> nav.navigate(StudyQuizR(q.id, own = id)) }) }
            composable<SavedR> { SavedScreen(open) { nav.navigate(QuestionR(it)) } }
            composable<ClassesR> { ClassesScreen { nav.popBackStack() } }
            composable<JoinR> { JoinScreen(back = { nav.popBackStack() }, openStudy = { nav.navigate(StudyR) }) { nav.navigate(CourseR(it)) } }
            composable<QuestionR> { QuestionScreen(it.toRoute<QuestionR>().id, back = { nav.popBackStack() }, openTopic = open) }
            composable<ProgressR> { ProgressScreen(open, openRoutine = { nav.navigate(RoutineR) }, openScores = { nav.navigate(ScoreCourseR(it)) }) }
            composable<RoutineR> { RoutineScreen { nav.popBackStack() } }
            composable<CalendarR> { CalendarScreen { nav.popBackStack() } }
            composable<ScoreCourseR> { ScoreCourseScreen(it.toRoute<ScoreCourseR>().cid, back = { nav.popBackStack() }) { q -> nav.navigate(AttemptsR(q)) } }
            composable<AttemptsR> { AttemptsScreen(it.toRoute<AttemptsR>().quiz, back = { nav.popBackStack() }) { id -> nav.navigate(AttemptR(id)) } }
            composable<AttemptR> { AttemptScreen(it.toRoute<AttemptR>().id, back = { nav.popBackStack() }, openTopic = open) }
            composable<RevisionR> { RevisionScreen(it.toRoute<RevisionR>().uid) { nav.popBackStack() } }
            composable<SearchR> { SearchScreen(it.toRoute<SearchR>().q, back = { nav.popBackStack() }, openTopic = open, openPhoto = { nav.navigate(PhotoR()) }) }
            composable<MeR> { ProfileScreen(me, wallpaper, theme, signOut, openPassword = { nav.navigate(PasswordR) }, openKey = { nav.navigate(KeyR) }) }
            composable<PasswordR> { ChangePassword(forced = false, back = { nav.popBackStack() }) { nav.popBackStack() } }
            composable<KeyR> { MyKeyScreen { nav.popBackStack() } }
            composable<CourseR> { CourseScreen(it.toRoute<CourseR>().id, back = { nav.popBackStack() }, openTopic = open, openQuiz = { q -> nav.navigate(QuizR(q)) },
                                               openMaterial = { cid, name -> nav.navigate(MaterialR(cid, name)) }, openRevision = { u -> nav.navigate(RevisionR(u)) }) }
            composable<TopicR> { TopicScreen(it.toRoute<TopicR>().id, me, back = { nav.popBackStack() }, jump = { id -> nav.navigate(TopicR(id)) { popUpTo<TopicR> { inclusive = true } } },
                                             openReader = { id -> nav.navigate(ReaderR(id)) }, openPractice = { q -> nav.navigate(StudyQuizR(q, it.toRoute<TopicR>().id)) },
                                             openMcq = { t -> nav.navigate(McqR(t)) }, openDiagram = { u -> nav.navigate(DiagramR(u)) },
                                             openMaterial = { cid, name -> nav.navigate(MaterialR(cid, name)) }) }
            composable<LearnR> { e -> val id = e.toRoute<LearnR>().id; LearnScreen(id, back = { nav.popBackStack() }) { nav.navigate(TopicR(id)) { popUpTo<LearnR> { inclusive = true } } } }
            composable<DiagramR> { DiagramScreen(it.toRoute<DiagramR>().url) { nav.popBackStack() } }
            composable<ReaderR> { e -> val id = e.toRoute<ReaderR>().id
                val t = rememberLoad("reader", id) { get("/topics/$id", app.zigora.data.TopicFull.serializer()) }
                Loaded(t) { ReaderScreen(it) { nav.popBackStack() } } }
            composable<StudyQuizR> { e -> val r = e.toRoute<StudyQuizR>()
                val own = if (r.own == 0) null else (rememberLoad("own-next", r.own) { get("/study/topics/${r.own}", app.zigora.data.STopicFull.serializer()) }.state as? Load.Ok)?.value
                val path = if (r.topic != 0) "/topics/${r.topic}/practice" else if (r.own != 0) "/study/topics/${r.own}/quizzes" else null
                StudyQuizScreen(r.id, back = { nav.popBackStack() }, again = path?.let { p -> { kind: String -> scope.launch {
                    try { val q = a.send("POST", p, kotlinx.serialization.json.buildJsonObject { put("kind", kind) }, app.zigora.data.StudyQuiz.serializer()).id
                          onMain { nav.navigate(StudyQuizR(q, r.topic, r.own)) { popUpTo<StudyQuizR> { inclusive = true } } } } catch (x: Exception) { toast(x.message.orEmpty()) }
                }; Unit } }, next = own?.next?.let { n -> n.title to { nav.popBackStack(); nav.navigate(StudyTopicR(n.id)) { popUpTo<StudyTopicR> { inclusive = true } } } }) }
            composable<MaterialR> { e -> val r = e.toRoute<MaterialR>(); MyMaterialScreen(r.cid, r.name) { nav.popBackStack() } }
            composable<QuizR> { QuizScreen(it.toRoute<QuizR>().id, back = { nav.popBackStack() }, openTopic = open,
                                           openAttempt = { id -> nav.navigate(AttemptR(id)) }, openAttempts = { q -> nav.navigate(AttemptsR(q)) }) }
            composable<McqR> { McqHomeScreen(it.toRoute<McqR>().topic, back = { nav.popBackStack() }) { id -> nav.navigate(McqSetR(id)) } }
            composable<McqSetR> { McqSetScreen(it.toRoute<McqSetR>().id, back = { nav.popBackStack() }, openTopic = open) }
            composable<PhotoR> { PhotoScreen(it.toRoute<PhotoR>().uri) { nav.popBackStack() } }
            composable<NotesR> { NotificationsScreen(back = { nav.popBackStack() }, openTopic = open, openQuestion = { nav.navigate(QuestionR(it)) }) }
        }
        }
        androidx.compose.material3.SnackbarHost(snackState, Modifier.align(androidx.compose.ui.Alignment.BottomCenter).padding(horizontal = 16.dp, vertical = 12.dp))
        }
    }
    }  // the drawer
    }
}

/** who is signed in, for parts that differ by role (only students flag an AI answer, as on the web) */
val LocalMe = androidx.compose.runtime.staticCompositionLocalOf<Me?> { null }

/** the app is the students' half of Zigora: staff are pointed to the web, where their tools are */
/** after a crash, the next start offers the report to share (by mail, chat, anything); it stays on the phone otherwise */
@Composable
private fun CrashNote() {
    val app = app(); val ctx = androidx.compose.ui.platform.LocalContext.current
    var report by remember { mutableStateOf(runCatching { app.crashFile.takeIf { it.exists() }?.readText() }.getOrNull()) }
    val text = report ?: return
    val done = { runCatching { app.crashFile.delete() }; report = null }
    androidx.compose.material3.AlertDialog(onDismissRequest = done, title = { Text(stringResource(R.string.crash_title)) }, text = { Text(stringResource(R.string.crash_body)) },
        confirmButton = { androidx.compose.material3.TextButton(onClick = {
            val send = android.content.Intent(android.content.Intent.ACTION_SEND).setType("text/plain").putExtra(android.content.Intent.EXTRA_SUBJECT, "Zigora crash report")
                .putExtra(android.content.Intent.EXTRA_TEXT, text)
            runCatching { ctx.startActivity(android.content.Intent.createChooser(send, null)) }; done()
        }) { Text(stringResource(R.string.crash_share)) } },
        dismissButton = { androidx.compose.material3.TextButton(onClick = done) { Text(stringResource(R.string.not_now)) } })
}
