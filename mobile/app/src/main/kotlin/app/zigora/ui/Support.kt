package app.zigora.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.zigora.data.I18n
import app.zigora.data.IvActState
import app.zigora.data.IvCompare
import app.zigora.data.IvPlan
import app.zigora.data.IvPlans
import app.zigora.data.McqSet
import app.zigora.data.MySupport
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// S45, learning support plans. Students see their teacher's extra practice in supportive words, each activity one tap away; done ticks come from what
// they did. Teachers follow each plan here (made on the web): who is where, before and after on the same topics, and their own review.
private fun ivKind(k: String) = when (k) { "study" -> tl("Study the topic"); "revise" -> tl("Read the revision sheet"); "mcq" -> tl("MCQ practice"); "test" -> tl("Take the test")
    "resource" -> tl("Open the teacher resource"); "ask" -> tl("Ask your teacher about it"); "relearn" -> tl("Learn the topic again from the start"); else -> k }
private fun ivAct(kind: String, label: String, size: Int?) = ivKind(kind) + (if (label.isNotEmpty()) ": $label" else "") + (if (kind == "mcq" && size != null) " · " + tl("{n} questions", "n" to size) else "")
private fun ivProg(p: String) = when (p) { "completed" -> tl("Completed"); "in_progress" -> tl("In progress"); else -> tl("Not started") }
private fun ivStatus(s: String) = when (s) { "draft" -> tl("Draft"); "active" -> tl("Active"); "completed" -> tl("Completed"); else -> tl("Cancelled") }
private val IV_OUT = listOf("improved" to "Improved", "partly" to "Partly improved", "not_yet" to "Not yet improved", "more_support" to "Needs more support")
private fun ivOut(o: String?) = IV_OUT.firstOrNull { it.first == o }?.let { tl(it.second) }
private fun ivOverall(o: String) = when (o) { "rose" -> tl("Accuracy rose"); "fell" -> tl("Accuracy fell"); "steady" -> tl("About the same"); "mixed" -> tl("Tests and practice moved differently")
    else -> tl("Outcome not yet established") }
private fun ivEv(e: String) = when (e) { "learned", "opened", "read", "asked", "learned again", "started over" -> tl(e); else -> e }
private fun ivState(a: IvActState) = when (a.state) { "done" -> tl("Done"); "started" -> tl("Started"); else -> tl("Not yet") }
private fun ivShow(s: String?) = s?.let { runCatching { java.time.Instant.parse(it).minusMillis(1).atZone(java.time.ZoneId.systemDefault()).toLocalDate()
    .format(java.time.format.DateTimeFormatter.ofPattern("d MMM", java.util.Locale.getDefault())) }.getOrNull() }.orEmpty()
private fun ivCounts(c: app.zigora.data.IvCounts) = listOfNotNull(if (c.students == 1) tl("{n} student", "n" to 1) else tl("{n} students", "n" to c.students), tl("{n} completed", "n" to c.completed),
    tl("{n} in progress", "n" to c.in_progress), tl("{n} not started", "n" to c.not_started), if (c.needs_review > 0) tl("{n} to review", "n" to c.needs_review) else null,
    if (c.overdue > 0) tl("{n} past the target", "n" to c.overdue) else null).joinToString(" · ")

/** a student's Home: their active plans, each activity opening where it is done */
@Composable
fun SupportCard(openTopic: (Int) -> Unit, openQuiz: (Int) -> Unit, openSet: (Int) -> Unit) {
    val l = rememberLoad("my-support") { runCatching { get("/me/support", MySupport.serializer()) }.getOrDefault(MySupport()) }
    val a = api(); val scope = rememberCoroutineScope(); val toast = rememberToast()
    var busy by remember { mutableStateOf(false) }
    val d = (l.state as? Load.Ok)?.value ?: return
    fun go(p: app.zigora.data.MySupportPlan, x: IvActState) {
        when (x.kind) {
            "test" -> x.ref_id?.let(openQuiz)
            "mcq" -> scope.launch {
                busy = true
                try {
                    val r = a.send("POST", "/mcq/attempts", buildJsonObject { put("mode", "topic"); put("source", "bank"); put("size", x.size ?: 10); put("topic_id", x.topic_id ?: 0)
                        put("request_id", java.util.UUID.randomUUID().toString()) }, McqSet.serializer())
                    onMain { openSet(r.id) }
                } catch (e: Exception) { toast(I18n.srv(e.message)) }
                busy = false
            }
            else -> (x.topic_id ?: p.topics.firstOrNull()?.id)?.let(openTopic)
        }
    }
    d.items.forEach { p ->
        Group {  // the plan's words on top, then each activity as a row of the same surface
            androidx.compose.foundation.layout.Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                Text(tl("Extra practice from your teacher"), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                Text(p.title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 4.dp))
                Quiet(listOfNotNull(p.course, p.target?.let { tl("aim to finish by {date}", "date" to ivShow(it)) }, tl("{a} of {n} done", "a" to p.done, "n" to p.required)).joinToString(" · "))
                if (p.description.isNotEmpty()) Quiet(p.description, Modifier.padding(top = 4.dp))
            }
            p.activities.forEach { x ->
                GroupLine()
                val click: (() -> Unit)? = if (busy) null else { { go(p, x) } }
                RowLink((if (x.state == "done") "✓ " else "") + ivAct(x.kind, x.label, x.size), listOfNotNull(if (x.state != "todo") ivState(x) else null, if (!x.required) tl("Optional") else null).joinToString(" · "), onClick = click)
            }
        }
    }
}

@Composable
private fun Compare(c: IvCompare) {
    Text(ivOverall(c.overall), style = MaterialTheme.typography.titleSmall)
    listOf(tl("Tests") to c.test, tl("Practice") to c.practice).forEach { (n, x) ->
        if (x.before.asked > 0 || x.after.asked > 0) Quiet("$n: " + (if (x.before.asked > 0) tl("{p}% of {n} answers", "p" to (x.before.percent ?: 0), "n" to x.before.asked) else tl("none")) + " → " +
            (if (x.after.asked > 0) tl("{p}% of {n} answers", "p" to (x.after.percent ?: 0), "n" to x.after.asked) else tl("none yet")) + (if (x.established) "" else " · " + tl("not enough yet")))
    }
}

/** a course's plans, for its teachers */
@Composable
fun SupportPlansScreen(cid: Int, back: () -> Unit, open: (Int) -> Unit) {
    var st by rememberSaveable { mutableStateOf("") }
    val l = rememberLoad("iv-list", cid, st) { get("/interventions?course_id=$cid&status=$st", IvPlans.serializer()) }
    Page(tl("Support plans"), (l.state as? Load.Ok)?.value?.items?.firstOrNull()?.course.orEmpty(), back = back) {
        Quiet(tl("Extra practice for chosen students, made from what the course already has. Progress comes from what they do after the plan starts."))
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(st == "", { st = "" }, { Text(tl("All")) }); listOf("draft", "active", "completed", "cancelled").forEach { k -> FilterChip(st == k, { st = k }, { Text(ivStatus(k)) }) }
        }
        Loaded(l) { d ->
            if (d.items.isEmpty()) Quiet(tl("No support plans yet."))
            d.items.forEach { p -> ListRow(p.title, ivStatus(p.status) + " · " + p.topics.joinToString(", ") { it.title } + (p.target?.let { " · " + tl("target {date}", "date" to ivShow(it)) } ?: ""), onClick = { open(p.id) }) { Quiet(ivCounts(p.counts)) } }
        }
    }
}

@Composable
fun SupportPlanScreen(id: Int, back: () -> Unit, openStudent: (Int) -> Unit) {
    val l = rememberLoad("iv", id) { get("/interventions/$id", IvPlan.serializer()) }
    Page((l.state as? Load.Ok)?.value?.title ?: tl("Support plan"), (l.state as? Load.Ok)?.value?.status?.let(::ivStatus).orEmpty(), back = back) {
        Loaded(l) { p ->
            Quiet(p.topics.joinToString(", ") { it.title } + (p.target?.let { " · " + tl("target {date}", "date" to ivShow(it)) } ?: ""))
            if (p.description.isNotEmpty()) Text(p.description, modifier = Modifier.padding(top = 4.dp))
            if (p.criteria.isNotEmpty()) Quiet(tl("How you will judge it") + ": " + p.criteria)
            Quiet(ivCounts(p.counts))
            SectionTitle(tl("Activities"))
            p.activities.forEachIndexed { k, a -> Quiet("${k + 1}. " + ivAct(a.kind, a.label, a.size) + " · " + (if (a.required) tl("Required") else tl("Optional")) + (if (a.removed_at != null) " · " + tl("removed {when}", "when" to ivShow(a.removed_at)) else "")) }
            SectionTitle(tl("Students"))
            Quiet(tl("Before and after compare the same topics, tests and practice apart. A change needs {q}+ answers over {k}+ sittings after the start; it doesn't show the plan caused it.", "q" to 5, "k" to 2))
            p.students.forEach { x ->
                ListRow(x.name, listOfNotNull(if (x.removed) tl("Removed from the plan") else if (x.assigned_at != null) ivProg(x.progress) + " · " + tl("{a} of {n} done", "a" to x.done, "n" to x.required) else tl("Not started yet: the plan is a draft"),
                    if (x.overdue) tl("past the target") else null, if (x.needs_review) tl("to review") else null, ivOut(x.outcome), if (x.assigned_at != null) ivOverall(x.comparison.overall) else null).joinToString(" · "),
                    onClick = { openStudent(x.user_id) })
            }
        }
    }
}

@Composable
fun SupportStudentScreen(id: Int, sid: Int, back: () -> Unit) {
    var tick by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    val l = rememberLoad("iv", id, tick) { get("/interventions/$id", IvPlan.serializer()) }
    val a = api(); val scope = rememberCoroutineScope(); val toast = rememberToast()
    val p = (l.state as? Load.Ok)?.value; val x = p?.students?.firstOrNull { it.user_id == sid }
    var out by remember(x?.outcome) { mutableStateOf(x?.outcome.orEmpty()) }
    var note by remember(x?.outcome_note) { mutableStateOf(x?.outcome_note.orEmpty()) }
    var busy by remember { mutableStateOf(false) }
    Page(x?.name.orEmpty(), p?.title.orEmpty(), back = back) {
        Loaded(l) { pp ->
            if (x == null) return@Loaded
            if (x.reason.isNotEmpty()) Quiet(tl("Why") + ": " + x.reason)
            Quiet(x.assigned_at?.let { tl("In the plan since {when}", "when" to ivShow(it)) } ?: tl("Not started yet: the plan is a draft"))
            SectionTitle(tl("Activities"))
            x.activities.forEach { s -> val pa = pp.activities.firstOrNull { it.id == s.id }
                Quiet((if (s.state == "done") "✓ " else if (s.state == "started") "… " else "○ ") + ivAct(s.kind, pa?.label.orEmpty(), s.size) + " — " +
                    listOfNotNull(ivState(s), s.evidence.takeIf { it.isNotEmpty() }?.let(::ivEv), if (!s.required) tl("Optional") else null, if (s.removed) tl("removed, done before") else null).joinToString(" · ")) }
            Quiet(tl("Opening a resource only shows it was opened, not that it was understood."))
            SectionTitle(tl("Before and after"))
            Panel { androidx.compose.foundation.layout.Column { Compare(x.comparison); Quiet(tl("Same topics, before the plan and since. This doesn't show the plan caused the change.")) } }
            if (x.assigned_at != null) {
                SectionTitle(tl("Your review"))
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) { IV_OUT.forEach { (k, v) -> FilterChip(out == k, { out = k }, { Text(tl(v)) }) } }
                OutlinedTextField(note, { note = it.take(2000) }, label = { Text(tl("A note for yourself (optional)")) }, modifier = Modifier.padding(top = 4.dp))
                Button(enabled = !busy && out.isNotEmpty(), onClick = { scope.launch {
                    busy = true
                    try { a.raw("POST", "/interventions/$id/students/$sid/review", buildJsonObject { put("outcome", out); put("note", note) }); toast(tl("Saved")); tick++ } catch (e: Exception) { toast(I18n.srv(e.message)) }
                    busy = false
                } }, modifier = Modifier.padding(top = 8.dp)) { Text(tl("Save review")) }
            }
        }
    }
}
