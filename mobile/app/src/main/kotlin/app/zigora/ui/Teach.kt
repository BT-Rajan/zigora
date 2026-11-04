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
import app.zigora.data.DoubtPage
import app.zigora.data.DoubtSummary
import app.zigora.data.DoubtReport
import app.zigora.data.DoubtGroup
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.OutlinedTextField
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
@Serializable data class InsightR(val cid: Int)
@Serializable data class InsightTopicR(val cid: Int, val tid: Int)
@Serializable data class InsightStudentR(val cid: Int, val tid: Int, val sid: Int)
@Serializable data class PlansR(val cid: Int)
@Serializable data class PlanR(val id: Int)
@Serializable data class PlanStudentR(val id: Int, val sid: Int)

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
            composable<StrugglesR> { StrugglesScreen(openInsight = { nav.navigate(InsightR(it)) }, openPlans = { nav.navigate(PlansR(it)) }) { nav.navigate(TopicR(it)) } }
            composable<PlansR> { SupportPlansScreen(it.toRoute<PlansR>().cid, back = { nav.popBackStack() }) { p -> nav.navigate(PlanR(p)) } }  // S45
            composable<PlanR> { val r = it.toRoute<PlanR>(); SupportPlanScreen(r.id, back = { nav.popBackStack() }) { sid -> nav.navigate(PlanStudentR(r.id, sid)) } }
            composable<PlanStudentR> { val r = it.toRoute<PlanStudentR>(); SupportStudentScreen(r.id, r.sid, back = { nav.popBackStack() }) }
            composable<InsightR> { val r = it.toRoute<InsightR>(); ClassInsightScreen(r.cid, back = { nav.popBackStack() }) { t -> nav.navigate(InsightTopicR(r.cid, t)) } }
            composable<InsightTopicR> { val r = it.toRoute<InsightTopicR>(); ClassTopicScreen(r.cid, r.tid, back = { nav.popBackStack() }) { sid -> nav.navigate(InsightStudentR(r.cid, r.tid, sid)) } }
            composable<InsightStudentR> { val r = it.toRoute<InsightStudentR>(); ClassStudentScreen(r.cid, r.tid, r.sid, back = { nav.popBackStack() }) }
            composable<StaffMeR> { StaffMeScreen(me, signOut) }
            composable<QuestionR> { QuestionScreen(it.toRoute<QuestionR>().id, back = { nav.popBackStack() }, openTopic = { t -> nav.navigate(TopicR(t)) }) }
            composable<TopicR> { TopicScreen(it.toRoute<TopicR>().id, me, back = { nav.popBackStack() }, jump = { t -> nav.navigate(TopicR(t)) }, openReader = {}, openPractice = {}, openMaterial = { _, _ -> }) }
        }
    } }
}

/** S42, the doubt management centre: counts, then the doubts filtered, searched and sorted on the server a page at a time; and a report tab */
private fun doubtLabel(l: String) = when (l) { "pending" -> tl("Pending"); "follow_up" -> tl("Follow-up"); "answered" -> tl("Answered"); "resolved" -> tl("Resolved"); else -> l }
private fun hours(h: Double) = if (h < 48) tl("{n} h", "n" to h.toInt()) else tl("{n} days", "n" to (h / 24).toInt())
@Composable
fun InboxScreen(open: (Int) -> Unit) {
    var tab by rememberSaveable { mutableStateOf("list") }
    var label by rememberSaveable { mutableStateOf("") }
    var overdue by rememberSaveable { mutableStateOf(false) }
    var unassigned by rememberSaveable { mutableStateOf(false) }
    var search by rememberSaveable { mutableStateOf("") }
    var query by rememberSaveable { mutableStateOf("") }
    var course by rememberSaveable { mutableIntStateOf(0) }
    var unit by rememberSaveable { mutableIntStateOf(0) }
    var sort by rememberSaveable { mutableStateOf("priority") }
    var since by rememberSaveable { mutableStateOf("") }
    var until by rememberSaveable { mutableStateOf("") }
    var page by rememberSaveable { mutableIntStateOf(0) }
    LaunchedEffect(search) { kotlinx.coroutines.delay(400); if (query != search) { query = search; page = 0 } }
    val day = Regex("""\d{4}-\d{2}-\d{2}""")
    val params = listOf("sort" to sort, "label" to label, "q" to query.trim(), "course_id" to (if (course > 0) "$course" else ""), "unit_id" to (if (unit > 0) "$unit" else ""),
                        "since" to (if (day.matches(since)) since else ""), "until" to (if (day.matches(until)) until else ""),
                        "overdue" to (if (overdue) "true" else ""), "unassigned" to (if (unassigned) "true" else ""))
        .filter { it.second.isNotEmpty() }.joinToString("&") { it.first + "=" + java.net.URLEncoder.encode(it.second, "UTF-8") }
    val sum = rememberLoad("doubt-sum") { get("/questions/summary", DoubtSummary.serializer()) }
    val l = rememberLoad("doubts", params, page) { get("/questions?$params&limit=20&offset=${page * 20}", DoubtPage.serializer()) }
    Page(tl("Student questions"), (l.state as? Load.Ok)?.value?.let { pl(it.total, "question") }.orEmpty()) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(tab == "list", { tab = "list" }, { Text(tl("Doubts")) }); FilterChip(tab == "report", { tab = "report" }, { Text(tl("Report")) })
        }
        if (tab == "report") { DoubtReportView(); return@Page }
        (sum.state as? Load.Ok)?.value?.let { su ->
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("pending" to su.pending, "follow_up" to su.follow_up, "answered" to su.answered, "resolved" to su.resolved).forEach { (k, n) ->
                    FilterChip(label == k, { label = if (label == k) "" else k; overdue = false; unassigned = false; page = 0 }, { Text(doubtLabel(k) + " · " + n) })
                }
                su.overdue?.let { n -> FilterChip(overdue, { overdue = !overdue; label = ""; page = 0 }, { Text(tl("Overdue") + " · " + n) }) }
                su.unassigned?.let { n -> FilterChip(unassigned, { unassigned = !unassigned; label = ""; page = 0 }, { Text(tl("No teacher") + " · " + n) }) }
            }
            if (su.overdue == null) Quiet(tl("No response target is set, so nothing is marked overdue."))
            if (su.courses.size > 1) Row(Modifier.horizontalScroll(rememberScrollState()).padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(course == 0, { course = 0; unit = 0; page = 0 }, { Text(tl("All courses")) })
                su.courses.forEach { c -> FilterChip(course == c.id, { course = c.id; unit = 0; page = 0 }, { Text(c.name) }) }
            }
            su.courses.firstOrNull { it.id == course }?.units?.takeIf { it.size > 1 }?.let { us ->
                Row(Modifier.horizontalScroll(rememberScrollState()).padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(unit == 0, { unit = 0; page = 0 }, { Text(tl("All units")) })
                    us.forEach { u -> FilterChip(unit == u.id, { unit = u.id; page = 0 }, { Text(u.name) }) }
                }
            }
        }
        OutlinedTextField(search, { search = it.take(100) }, Modifier.fillMaxWidth().padding(top = 8.dp), singleLine = true, label = { Text(tl("Search by student, question or topic")) })
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("priority" to tl("Oldest unanswered first"), "followups" to tl("Follow-ups first"), "submitted" to tl("Newest submitted"), "updated" to tl("Latest activity")).forEach { (k, t) ->
                FilterChip(sort == k, { sort = k; page = 0 }, { Text(t) })
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(since, { since = it.take(10); page = 0 }, Modifier.weight(1f), singleLine = true, label = { Text(tl("From")) }, placeholder = { Text("2026-01-31") })
            OutlinedTextField(until, { until = it.take(10); page = 0 }, Modifier.weight(1f), singleLine = true, label = { Text(tl("To")) }, placeholder = { Text("2026-01-31") })
        }
        Loaded(l) { d ->
            if (d.items.isEmpty()) Quiet(tl("No doubts match."), Modifier.padding(top = 12.dp))
            d.items.forEach { x ->
                ListRow(x.topic.ifEmpty { x.course }, listOf(doubtLabel(x.label) + (if (x.overdue) " · " + tl("Overdue") else ""), x.student, x.course, x.unit).filter { it.isNotEmpty() }.joinToString(" · "),
                        onClick = { open(x.id) }) {
                    if (x.preview.isNotEmpty()) Quiet(x.preview, Modifier.padding(top = 4.dp))
                    Quiet(listOfNotNull(x.at?.let { tl("Asked {when}", "when" to stamp(it)) }, x.updated?.let { tl("last activity {when}", "when" to stamp(it)) },
                                        x.waiting_hours?.let { tl("waiting {t}", "t" to hours(it)) }, x.teacher?.let { tl("Teacher: {name}", "name" to it) } ?: tl("No teacher assigned"),
                                        if (x.reopens > 0) tl("reopened {n}×", "n" to x.reopens) else null).joinToString(" · "))
                }
            }
            if (d.total > 20) Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                OutlinedButton(enabled = page > 0, onClick = { page-- }) { Text("‹") }
                Text("${page + 1} / ${(d.total + 19) / 20}", Modifier.padding(top = 12.dp))
                OutlinedButton(enabled = (page + 1) * 20 < d.total, onClick = { page++ }) { Text("›") }
            }
        }
    }
}

@Composable
private fun DoubtReportView() {
    var days by rememberSaveable { mutableIntStateOf(90) }
    val l = rememberLoad("doubt-report", days) { get("/questions/report?days=$days", DoubtReport.serializer()) }
    Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(30, 90, 365).forEach { n -> FilterChip(days == n, { days = n }, { Text(tl("Last {n} days", "n" to n)) }) }
    }
    Loaded(l) { d ->
        if (d.total == 0) { Quiet(tl("No doubts in this period."), Modifier.padding(top = 12.dp)); return@Loaded }
        Quiet(listOf(tl("{n} doubts", "n" to d.total), tl("{n} pending", "n" to d.pending), tl("{n} follow-ups", "n" to d.follow_up), tl("{n} reopened", "n" to d.reopened)).joinToString(" · "), Modifier.padding(top = 8.dp))
        Quiet(tl("Counts of doubts asked in this period, by where they came from. No AI is involved."))
        fun sub(g: DoubtGroup) = listOf(listOf(g.course, g.unit).filter { it.isNotEmpty() }.joinToString(" › "), if (g.doubts == 1) tl("1 doubt") else tl("{n} doubts", "n" to g.doubts),
                                        if (g.pending > 0) tl("{n} pending", "n" to g.pending) else "", if (g.follow_up > 0) tl("{n} follow-ups", "n" to g.follow_up) else "",
                                        if (g.reopened > 0) tl("{n} reopened", "n" to g.reopened) else "").filter { it.isNotEmpty() }.joinToString(" · ")
        SectionTitle(tl("Topics with the most doubts")); d.by_topic.forEach { ListRow(it.name, sub(it)) }
        SectionTitle(tl("By course")); d.by_course.forEach { ListRow(it.name, sub(it)) }
        if (d.by_unit.isNotEmpty()) { SectionTitle(tl("By unit")); d.by_unit.forEach { ListRow(it.name, sub(it)) } }
        if (d.asks_again.isNotEmpty()) {
            SectionTitle(tl("Students who often ask again")); Quiet(tl("Wrote again after an answer at least twice in this period."))
            d.asks_again.forEach { ListRow(it.name, tl("{n} follow-ups", "n" to it.follow_ups)) }
        }
    }
}

/** per topic, what students did when stuck over the last weeks, most first */
@Composable
fun StrugglesScreen(openInsight: (Int) -> Unit = {}, openPlans: (Int) -> Unit = {}, openTopic: (Int) -> Unit) {
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
            d.courses.forEach { c -> OutlinedButton(onClick = { openInsight(c.id) }, modifier = Modifier.padding(top = 4.dp)) { Text(tl("Class insight") + ": " + c.name) }
                OutlinedButton(onClick = { openPlans(c.id) }, modifier = Modifier.padding(top = 4.dp)) { Text(tl("Support plans") + ": " + c.name) } }  // S44, S45
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
