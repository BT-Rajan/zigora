package app.zigora.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.School
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import app.zigora.AnswerWatch
import app.zigora.Incoming
import app.zigora.R
import app.zigora.data.Me
import app.zigora.data.QuestionPage
import app.zigora.data.Struggles
import kotlinx.serialization.Serializable
import kotlinx.coroutines.launch
import kotlinx.serialization.json.put

// The teacher's side of the app (faculty and admins): students' questions to answer, classes and announcements to post, and where students
// struggle. Everything else (courses, topics, tests, settings) stays on the web.

@Serializable object InboxR
@Serializable object ClassesR
@Serializable object StrugglesR
@Serializable object StaffMeR
@Serializable object OffersR
@Serializable data class OfferR(val id: Int)
@Serializable object TeacherHomeR

@Composable
fun StaffMain(me: Me, incoming: Incoming?, handled: () -> Unit, signOut: () -> Unit) {
    val school = me.role == "guardian"  // a school teacher: their students come first, then the teacher's pages
    val nav = rememberNavController(); val ctx = LocalContext.current
    LaunchedEffect(me.id) { AnswerWatch.schedule(ctx, true) }  // a note on the phone when a question comes in
    LaunchedEffect(incoming) {
        when (incoming) { is Incoming.Question -> nav.navigate(QuestionR(incoming.id)); is Incoming.Classes -> nav.navigate(ClassesR); null -> return@LaunchedEffect; else -> {} }
        handled()
    }
    val tabs = (if (school) listOf(Triple(TeacherHomeR, tl("Students"), Icons.Outlined.AccountCircle)) else emptyList()) +
               listOf(Triple(InboxR, tl("Questions"), Icons.AutoMirrored.Outlined.Chat), Triple(ClassesR, tl("Classes"), Icons.Outlined.Campaign),
                      Triple(OffersR, tl("Courses"), Icons.Outlined.School), Triple(StrugglesR, tl("Struggles"), Icons.Outlined.Insights)) +
               (if (school) emptyList() else listOf(Triple(StaffMeR, stringResource(R.string.tab_me), Icons.Outlined.AccountCircle)))
    val start: Any = if (school) TeacherHomeR else InboxR
    val entry by nav.currentBackStackEntryAsState(); val dest = entry?.destination
    androidx.compose.runtime.CompositionLocalProvider(LocalMe provides me) { NavigationSuiteScaffold(navigationSuiteItems = {
        tabs.forEach { (r, l, i) -> item(selected = dest?.hasRoute(r::class) == true, icon = { Icon(i, null) }, label = { Text(l, maxLines = 1) },
            onClick = { nav.navigate(r) { popUpTo(start) { saveState = true }; launchSingleTop = true; restoreState = true } }) }
    }) {
        NavHost(nav, startDestination = start) {
            composable<TeacherHomeR> { GuardianHome(me, signOut) }
            composable<OffersR> { OfferedScreen(openCourse = { nav.navigate(OfferR(it)) }) }
            composable<OfferR> { OfferDetailScreen(it.toRoute<OfferR>().id) { nav.popBackStack() } }
            composable<InboxR> { InboxScreen { nav.navigate(QuestionR(it)) } }
            composable<ClassesR> { ClassesScreen(null) }
            composable<StrugglesR> { StrugglesScreen { nav.navigate(TopicR(it)) } }
            composable<StaffMeR> { StaffMeScreen(me, signOut) }
            composable<QuestionR> { QuestionScreen(it.toRoute<QuestionR>().id, back = { nav.popBackStack() }, openTopic = { t -> nav.navigate(TopicR(t)) }) }
            composable<TopicR> { TopicScreen(it.toRoute<TopicR>().id, me, back = { nav.popBackStack() }, jump = { t -> nav.navigate(TopicR(t)) }, openReader = {}, openPractice = {}, openMaterial = { _, _ -> }) }
        }
    } }
}

/** students' questions: waiting for an answer first (oldest first), or every one */
@Composable
fun InboxScreen(open: (Int) -> Unit) {
    var all by rememberSaveable { mutableStateOf(false) }
    val l = rememberLoad("inbox", all) { get("/questions?limit=50&status=" + (if (all) "all" else "waiting"), QuestionPage.serializer()) }
    Page(tl("Student questions"), (l.state as? Load.Ok)?.value?.let { pl(it.total, "question") }.orEmpty()) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(!all, { all = false }, { Text(tl("Waiting for you")) }); FilterChip(all, { all = true }, { Text(tl("All")) })
        }
        Loaded(l) { d ->
            if (d.items.isEmpty()) Quiet(if (all) tl("No questions yet.") else tl("No question is waiting for you."), Modifier.padding(top = 12.dp))
            d.items.forEach { x ->
                ListRow(x.topic, listOfNotNull(x.course, x.student, when (x.status) { "waiting" -> tl("Waiting for your answer"); "answered" -> tl("Answered"); else -> tl("Closed") })
                    .filter { it.isNotEmpty() }.joinToString(" · "), onClick = { open(x.id) }) { if (x.last.isNotEmpty()) Quiet(x.last, Modifier.padding(top = 4.dp)) }
            }
        }
    }
}

/** per topic, what students did when stuck over the last weeks, most first */
@Composable
fun StrugglesScreen(openTopic: (Int) -> Unit) {
    var days by rememberSaveable { mutableIntStateOf(30) }
    var toastText by androidx.compose.runtime.remember { mutableStateOf("") }
    var help by androidx.compose.runtime.remember { mutableStateOf<Pair<Int, String>?>(null) }; var helpText by androidx.compose.runtime.remember { mutableStateOf("") }
    var helpMsg by androidx.compose.runtime.remember { mutableStateOf("") }
    val api = api(); val scope = androidx.compose.runtime.rememberCoroutineScope()
    help?.let { (tid, name) ->
        androidx.compose.material3.AlertDialog(onDismissRequest = { help = null }, title = { Text(tl("Offer help with {topic}", "topic" to name)) },
            text = { androidx.compose.foundation.layout.Column {
                Quiet(tl("Goes to every student who was stuck on this topic in this period. You won't see who they are; each can answer you in their own thread."))
                androidx.compose.material3.OutlinedTextField(helpText, { helpText = it.take(1000) }, Modifier.fillMaxWidth().padding(top = 8.dp), minLines = 3, label = { Text(tl("Message")) })
                if (helpMsg.isNotEmpty()) Text(helpMsg, color = MaterialTheme.colorScheme.error)
            } },
            confirmButton = { androidx.compose.material3.TextButton(enabled = helpText.trim().length >= 3, onClick = { scope.launch {
                try { val r = api.send("POST", "/topics/$tid/offer-help", kotlinx.serialization.json.buildJsonObject { put("text", helpText.trim()); put("days", days) }, app.zigora.data.Sent.serializer())
                      help = null; helpMsg = ""; toastText = if (r.sent == 1) tl("Sent to 1 student") else tl("Sent to {n} students", "n" to r.sent) }
                catch (e: Exception) { helpMsg = app.zigora.data.I18n.srv(e.message) }
            } }) { Text(tl("Send")) } },
            dismissButton = { androidx.compose.material3.TextButton(onClick = { help = null }) { Text(stringResource(R.string.cancel)) } })
    }
    val l = rememberLoad("struggles", days) { get("/reports/struggles?days=$days", Struggles.serializer()) }
    Page(tl("Where students struggle"), tl("Last {n} days", "n" to days)) {
        if (toastText.isNotEmpty()) Text(toastText, color = MaterialTheme.colorScheme.primary)
        Quiet(tl("Topics where students got stuck most: questions to you, Not clear? on a phrase, Not quite after a quick check, asking for it more simply, and flagged answers. Counts only, never names."))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf(7, 30, 90).forEach { n -> FilterChip(days == n, { days = n }, { Text(tl("Last {n} days", "n" to n)) }) } }
        Loaded(l) { d ->
            if (d.items.isEmpty()) Quiet(tl("No signs of trouble in this period."), Modifier.padding(top = 12.dp))
            d.items.forEachIndexed { i, x ->
                val bits = listOf(Triple(x.questions, "1 question to you", "{n} questions to you"), Triple(x.doubts, "1 Not clear? tap", "{n} Not clear? taps"),
                                  Triple(x.not_quite, "1 Not quite after a quick check", "{n} Not quite after a quick check"), Triple(x.simpler, "1 asked for it more simply", "{n} asked for it more simply"),
                                  Triple(x.flags, "1 flagged answer", "{n} flagged answers")).filter { it.first > 0 }.joinToString(" · ") { (n, one, many) -> if (n == 1) tl(one) else tl(many, "n" to n) }
                ListRow("${i + 1}. ${x.topic}", x.course + " · " + (if (x.students == 1) tl("1 student") else tl("{n} students", "n" to x.students)), onClick = { openTopic(x.topic_id) }) {
                    Text(bits, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
                    x.asked.forEach { q -> Quiet("“$q”", Modifier.padding(top = 2.dp)) }
                    androidx.compose.material3.TextButton(onClick = { help = x.topic_id to x.topic; helpText = ""; helpMsg = "" }) { Text(tl("Offer help")) }
                }
            }
        }
    }
}

@Composable
private fun StaffMeScreen(me: Me, signOut: () -> Unit) {
    val app = app(); val ctx = LocalContext.current
    Page(stringResource(R.string.tab_me)) {
        Panel { Text(me.name, style = MaterialTheme.typography.titleLarge); Quiet(app.store.server) }
        Quiet(tl("Courses, topics, tests and settings are on the website."), Modifier.padding(top = 8.dp))
        OutlinedButton(onClick = { runCatching { ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, app.store.server.toUri())) } }, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.open_in_browser)) }
        OutlinedButton(onClick = signOut, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.sign_out)) }
        if (me.role == "admin") MoreAiPanel()
    }
}
