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

// The teacher's side of the app (faculty and admins): students' questions to answer, classes and announcements to post, and where students
// struggle. Everything else (courses, topics, tests, settings) stays on the web.

@Serializable object InboxR
@Serializable object ClassesR
@Serializable object StrugglesR
@Serializable object StaffMeR

@Composable
fun StaffMain(me: Me, incoming: Incoming?, handled: () -> Unit, signOut: () -> Unit) {
    val nav = rememberNavController(); val ctx = LocalContext.current
    LaunchedEffect(me.id) { AnswerWatch.schedule(ctx, true) }  // a note on the phone when a question comes in
    LaunchedEffect(incoming) {
        when (incoming) { is Incoming.Question -> nav.navigate(QuestionR(incoming.id)); is Incoming.Classes -> nav.navigate(ClassesR); null -> return@LaunchedEffect; else -> {} }
        handled()
    }
    val tabs = listOf(Triple(InboxR, tl("Questions"), Icons.AutoMirrored.Outlined.Chat), Triple(ClassesR, tl("Classes"), Icons.Outlined.Campaign),
                      Triple(StrugglesR, tl("Struggles"), Icons.Outlined.Insights), Triple(StaffMeR, stringResource(R.string.tab_me), Icons.Outlined.AccountCircle))
    val entry by nav.currentBackStackEntryAsState(); val dest = entry?.destination
    androidx.compose.runtime.CompositionLocalProvider(LocalMe provides me) { NavigationSuiteScaffold(navigationSuiteItems = {
        tabs.forEach { (r, l, i) -> item(selected = dest?.hasRoute(r::class) == true, icon = { Icon(i, null) }, label = { Text(l, maxLines = 1) },
            onClick = { nav.navigate(r) { popUpTo(InboxR) { saveState = true }; launchSingleTop = true; restoreState = true } }) }
    }) {
        NavHost(nav, startDestination = InboxR) {
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
    val l = rememberLoad("struggles", days) { get("/reports/struggles?days=$days", Struggles.serializer()) }
    Page(tl("Where students struggle"), tl("Last {n} days", "n" to days)) {
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
