package app.zigora.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.TextButton
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.zigora.data.CiAcc
import app.zigora.data.CiCourse
import app.zigora.data.CiExplain
import app.zigora.data.CiRec
import app.zigora.data.CiStudent
import app.zigora.data.CiTopicDetail
import app.zigora.data.I18n
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

// S44, class insight: where a course's students struggle, from existing records. Every figure has its sample; topics are judged only with enough
// evidence; suggestions carry their evidence; the AI explains only when the teacher asks.
internal fun ciStatus(s: String?) = when (s) { "needs_study" -> tl("Needs attention"); "getting_there" -> tl("Needs revision"); "strong" -> tl("Strong"); else -> tl("Not assessed yet") }
private fun ciCat(c: String) = when (c) { "attention" -> tl("Needs attention"); "revision" -> tl("Needs revision"); "insufficient" -> tl("Not enough evidence yet")
    "studied_not_assessed" -> tl("Studied, not assessed"); "not_studied" -> tl("Not studied yet"); else -> tl("Strong") }
private val CI_CATS = listOf("attention", "revision", "insufficient", "studied_not_assessed", "not_studied", "strong")
private fun ciAcc(a: CiAcc) = if (a.asked > 0) tl("{p}% of {n} answers, {k} students", "p" to (a.percent ?: 0), "n" to a.asked, "k" to a.students) else tl("none yet")
private fun ciRec(r: CiRec): Pair<String, String> = when (r.key) {
    "explain" -> tl("Explain this topic again in class") to tl("{n} of {of} students with enough evidence need attention", "n" to r.n, "of" to r.of)
    "common" -> tl("Prepare one explanation for a shared doubt") to tl("{n} students asked about: {words}", "n" to r.n, "words" to r.words.joinToString(", "))
    "practice" -> tl("Assign targeted MCQs on the idea behind a commonly missed question") to tl("{n} of {of} answers chose the same wrong option: “{question}”", "n" to r.n, "of" to r.of, "question" to r.question)
    "revise" -> tl("Point students to the revision sheet") to tl("{n} students marked it learned, but their results say it hasn't settled yet", "n" to r.n)
    "individual" -> tl("Consider individual support") to tl("{n} students keep scoring low after 3 or more sittings", "n" to r.n)
    "keep" -> tl("Keep the current approach") to tl("Accuracy rose from {from}% to {to}% in the last 30 days", "from" to r.from, "to" to r.to)
    else -> r.key to ""
}
private fun opt(e: JsonElement?) = (e as? JsonPrimitive)?.content ?: e?.toString().orEmpty()

@Composable
fun ClassInsightScreen(cid: Int, back: () -> Unit, openTopic: (Int) -> Unit) {
    var unit by rememberSaveable { mutableIntStateOf(0) }
    val l = rememberLoad("ci", cid, unit) { get("/reports/courses/$cid/topics" + (if (unit > 0) "?unit_id=$unit" else ""), CiCourse.serializer()) }
    Page(tl("Class insight"), (l.state as? Load.Ok)?.value?.course.orEmpty(), back = back) {
        Loaded(l) { d ->
            if (d.units.size > 1) Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(unit == 0, { unit = 0 }, { Text(tl("All units")) }); d.units.forEach { u -> FilterChip(unit == u.id, { unit = u.id }, { Text(u.name) }) }
            }
            Panel { Text(tl("{a} of {n} students were active in this period.", "a" to d.active, "n" to d.students), style = MaterialTheme.typography.titleMedium) }
            Paged(d.topics, key = "ci") { t ->  // one surface; each topic: where it stands, the evidence, then what to do
                ListRow(t.title, tl("studied {a}/{n}", "a" to t.studied, "n" to t.students) + " · " + tl("enough evidence {a}", "a" to t.evidence), onClick = { openTopic(t.topic_id) }) {
                    Text(ciStatus(t.status), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 4.dp))
                    if (t.evidence > 0) Quiet(tl("Strong {a} · needs revision {b} · needs attention {c}", "a" to t.strong, "b" to t.needs_revision, "c" to t.needs_attention))
                    Quiet(tl("Tests") + ": " + ciAcc(t.tests) + " · " + tl("Practice") + ": " + ciAcc(t.practice))
                    if (t.doubts > 0 || t.not_clear > 0) Quiet(tl("Doubts {a} ({u} unresolved) · “Not clear?” {b}", "a" to t.doubts, "u" to t.unresolved, "b" to t.not_clear))
                    t.recommendations.forEach { r -> val (a, b) = ciRec(r)
                        Text("→ $a" + (if (b.isNotEmpty()) " — $b" else ""), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp)) }
                }
            }
            Quiet(tl("Opening a topic counts as studied, and marking it learned is the student's own word; neither shows understanding. Understanding comes from tests and MCQ practice: a student needs {q}+ questions over {k}+ sittings, and a topic needs {m}+ such students before it is judged.",
                     "q" to d.rule.student.min_questions, "k" to d.rule.student.min_sittings, "m" to d.rule.min_assessed), Modifier.padding(top = 4.dp))
        }
    }
}

@Composable
fun ClassTopicScreen(cid: Int, tid: Int, back: () -> Unit, openStudent: (Int) -> Unit) {
    var cat by rememberSaveable { mutableStateOf("") }
    var page by rememberSaveable { mutableIntStateOf(0) }
    var ai by remember { mutableStateOf<CiExplain?>(null) }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf("") }
    val a = api(); val scope = rememberCoroutineScope()
    val l = rememberLoad("ci-topic", cid, tid, cat, page) { get("/reports/courses/$cid/topics/$tid?category=$cat&limit=30&offset=${page * 30}", CiTopicDetail.serializer()) }
    Page((l.state as? Load.Ok)?.value?.topic?.title ?: tl("Topic"), tl("Class insight"), back = back) {
        Loaded(l) { d ->
            val t = d.topic
            Quiet(ciStatus(t.status) + " · " + tl("{e} of {n} students have enough evidence", "e" to t.evidence, "n" to t.students))
            Panel {
                Text(tl("Ask the AI what the evidence suggests"), style = MaterialTheme.typography.titleMedium)
                Quiet(tl("It gets only the figures below, the commonly missed questions and the doubts' words, never names, and must cite them. Nothing is decided for you."))
                val x = ai
                if (x == null) androidx.compose.material3.FilledTonalButton(enabled = !busy, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), onClick = { scope.launch {
                    busy = true; err = ""
                    try { ai = a.send("POST", "/reports/courses/$cid/topics/$tid/explain", null, CiExplain.serializer()) } catch (e: Exception) { err = I18n.srv(e.message) }
                    busy = false
                } }) { Text(if (busy) tl("Thinking…") else tl("Explain this topic's difficulties")) }
                else {
                    MathMd(x.text)
                    if (x.unverified_numbers.isNotEmpty()) Text(tl("Check these numbers: they aren't in the evidence: {list}", "list" to x.unverified_numbers.joinToString(", ")), color = MaterialTheme.colorScheme.error)
                    Quiet(tl("The evidence it was given ({n} lines)", "n" to x.evidence.size))
                    x.evidence.forEach { e -> Quiet("[${e.id}] ${e.text}") }
                }
                if (err.isNotEmpty()) Text(err, color = MaterialTheme.colorScheme.error)
            }
            if (d.common_wrong.isNotEmpty()) {
                SectionTitle(tl("Questions many got wrong the same way"))
                Paged(d.common_wrong, key = "cw") { q ->
                    Panel {
                        MathMd(q.text)
                        Quiet(tl("{n} answers from {k} students · {source}", "n" to q.answered, "k" to q.students, "source" to (if (q.source == "practice") tl("MCQ practice") else q.source)))
                        q.options.forEachIndexed { k, o ->  // the right answer in the brand's colour, the common wrong one in red
                            Text((if (k == q.correct) "✓ " else if (k == q.wrong_option) "✗ " else "") + opt(o) + " — " + (if (k == q.correct) tl("correct") else tl("chosen wrongly {n}×", "n" to (q.picks["$k"] ?: 0))),
                                 style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp),
                                 color = if (k == q.correct) MaterialTheme.colorScheme.primary else if (k == q.wrong_option) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
            if (d.doubt_groups.isNotEmpty() || d.other_doubts.isNotEmpty()) {
                SectionTitle(tl("Doubts"))
                Group {  // each group of like doubts, then the rest, as rows of one surface
                    d.doubt_groups.forEachIndexed { i, g -> if (i > 0) GroupLine()
                        ListRow(tl("{n} students asked about: {words}", "n" to g.students, "words" to g.words.joinToString(", ")), g.doubts.joinToString("\n") { "“${it.text}” — ${it.student}" }) }
                    if (d.other_doubts.isNotEmpty()) { if (d.doubt_groups.isNotEmpty()) GroupLine()
                        ListRow(tl("Other doubts ({n})", "n" to d.other_doubts.size), d.other_doubts.joinToString("\n") { "“${it.text}” — ${it.student}" }) }
                }
            }
            SectionTitle(tl("Students"))
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(cat == "", { cat = ""; page = 0 }, { Text(tl("All") + " (" + d.categories.values.sum() + ")") })
                CI_CATS.filter { (d.categories[it] ?: 0) > 0 }.forEach { k -> FilterChip(cat == k, { cat = k; page = 0 }, { Text(ciCat(k) + " (" + d.categories[k] + ")") }) }
            }
            Paged(d.students, key = "st") { x ->
                ListRow(x.name, listOfNotNull(ciCat(x.category), if (x.asked > 0) tl("{p}% of {n} answers over {k} sittings", "p" to (x.percent ?: 0), "n" to x.asked, "k" to x.sittings) else null,
                    if (x.improving) tl("improving") else null, if (x.repeated_errors > 0) tl("{n} questions wrong twice or more", "n" to x.repeated_errors) else null,
                    if (x.learned) tl("marked learned") else null, if (x.doubts == 1) tl("1 doubt") else if (x.doubts > 1) tl("{n} doubts", "n" to x.doubts) else null).joinToString(" · "), onClick = { openStudent(x.id) })
            }
            if (d.total > 30) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                TextButton(enabled = page > 0, onClick = { page-- }) { Text("‹") }
                Quiet("${page * 30 + 1}–${minOf((page + 1) * 30, d.total)} / ${d.total}")
                TextButton(enabled = (page + 1) * 30 < d.total, onClick = { page++ }) { Text("›") }
            }
            Quiet(tl("Grouped by what their records show, not ranked."))
        }
    }
}

@Composable
fun ClassStudentScreen(cid: Int, tid: Int, sid: Int, back: () -> Unit) {
    val l = rememberLoad("ci-student", cid, tid, sid) { get("/reports/courses/$cid/topics/$tid/students/$sid", CiStudent.serializer()) }
    Page((l.state as? Load.Ok)?.value?.student.orEmpty(), (l.state as? Load.Ok)?.value?.topic.orEmpty(), back = back) {
        Loaded(l) { d ->
            Panel {
                Text(ciStatus(d.label), style = MaterialTheme.typography.titleMedium)
                Quiet(listOfNotNull(if (d.studied) tl("opened the topic") else tl("hasn't opened the topic"), if (d.learned) tl("marked learned") else null).joinToString(" · "))
            }
            SectionTitle(tl("Sittings"))
            if (d.sittings.isEmpty()) Quiet(tl("No tests or MCQ sets on this topic yet."))
            Paged(d.sittings, key = "sit") { x -> ListRow(if (x.kind == "test") tl("Test") else tl("MCQ practice"), (x.at?.let { stamp(it) } ?: "") + " · " + tl("{a} of {n} right", "a" to x.right, "n" to x.asked),
                                                         trailing = { Text("${x.percent ?: 0}%", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary) }) }
            if (d.repeated_errors.isNotEmpty()) {
                SectionTitle(tl("Questions got wrong twice or more"))
                Paged(d.repeated_errors, key = "re") { x -> Panel {
                    MathMd(x.text)
                    Quiet(tl("Wrong {n} times; usually chose “{o}”; correct: “{c}”", "n" to x.times_wrong, "o" to opt(x.chosen?.let { x.options.getOrNull(it) }), "c" to opt(x.correct?.let { x.options.getOrNull(it) })))
                } }
            }
            SectionTitle(tl("Revision"))
            Panel { Text(if (d.revised.isNotEmpty()) tl("Read the revision sheet {n} times, last {when}", "n" to d.revised.size, "when" to stamp(d.revised.last())) else tl("Hasn't read the revision sheet.")) }
            if (d.doubts.isNotEmpty()) {
                SectionTitle(tl("Doubts"))
                Paged(d.doubts, key = "dq") { q -> Panel {
                    q.messages.forEach { m -> Quiet((if (m.teacher) tl("Teacher") else d.student) + " · " + (m.at?.let { stamp(it) } ?: "")); MathMd(m.text) }
                } }
            }
        }
    }
}
