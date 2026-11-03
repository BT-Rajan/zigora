package app.zigora.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.zigora.R
import app.zigora.data.AttemptOut
import app.zigora.data.DraftReply
import app.zigora.data.Quiz
import app.zigora.data.QuizDraft
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject

/** a teacher's quiz or test, as on the web: every question on one page, then the score, what to revisit, and each answer right or wrong */
@Composable
fun QuizScreen(id: Int, back: () -> Unit, openTopic: (Int) -> Unit, openAttempt: (Int) -> Unit, openAttempts: (Int) -> Unit) {
    val a = api(); val scope = rememberCoroutineScope(); val ctx = androidx.compose.ui.platform.LocalContext.current
    var tick by remember { mutableIntStateOf(0) }
    val quiz = rememberLoad("quiz", id, tick) { get("/quizzes/$id", Quiz.serializer()) }
    val q = (quiz.state as? Load.Ok)?.value
    // the sitting: its id goes with every save and every try of its submit, so a retry is never a second attempt. Its answers come back from the
    // server's copy, or from this phone's if that is newer (saved while offline), so a closed app or a lost connection loses nothing
    val prefs = remember { ctx.getSharedPreferences("quiz_drafts", android.content.Context.MODE_PRIVATE) }; val key = "q$id"
    val init = remember(q) { q?.let { qz ->
        val loc = prefs.getString(key, null)?.let { runCatching { app.zigora.data.json.decodeFromString(QuizDraft.serializer(), it) }.getOrNull() }
        val srv = qz.draft; val useLoc = loc != null && (srv == null || (loc.request_id == srv.request_id && loc.version > srv.version))
        val d = if (useLoc) loc!! else srv ?: QuizDraft(java.util.UUID.randomUUID().toString())
        Pair(d, useLoc)
    } }
    val picks = remember(q) { mutableStateListOf<Int?>().apply { q?.questions?.forEach { x -> add(init?.first?.answers?.get(x.id.toString())) } } }
    var out by remember(q) { mutableStateOf<AttemptOut?>(null) }
    val sitting = init?.first?.request_id.orEmpty()
    var ver by remember(q) { mutableIntStateOf(init?.first?.version ?: 0) }
    var kept by remember(q) { mutableStateOf(if (init?.second == true) "offline" else "") }  // "", saving, saved, offline or submitted
    var pending by remember(q) { mutableStateOf(init?.second == true) }
    val resumed = remember(q) { picks.any { it != null } }
    fun answersNow() = q?.questions.orEmpty().mapIndexedNotNull { i, x -> picks.getOrNull(i)?.let { x.id.toString() to it } }.toMap()
    fun keepHere() = prefs.edit().putString(key, app.zigora.data.json.encodeToString(QuizDraft.serializer(), QuizDraft(sitting, answersNow(), ver))).apply()
    fun push() {
        val qz = q ?: return; val at = ver
        val body = buildJsonObject { put("request_id", sitting); put("version", at); putJsonObject("answers") { answersNow().forEach { (k, v) -> put(k, v) } } }
        kept = "saving"
        scope.launch {
            try {
                val r = a.send("PUT", "/quizzes/$id/draft", body, DraftReply.serializer())
                if (ver != at) return@launch  // a newer answer is on its way
                val d = r.draft
                if (!r.saved && d != null && d.version > at) { ver = d.version; qz.questions.forEachIndexed { i, x -> picks[i] = d.answers[x.id.toString()] } }  // newer answers from another device
                pending = false; kept = "saved"
            } catch (e: Exception) {
                if (ver != at) return@launch
                if ((e as? app.zigora.data.ApiError)?.code == 409) { prefs.edit().remove(key).apply(); pending = false; kept = "submitted" }  // submitted elsewhere
                else { pending = true; kept = "offline" }
            }
        }
    }
    androidx.compose.runtime.LaunchedEffect(q) { if (init?.second == true) push() }
    androidx.compose.runtime.LaunchedEffect(q, pending) { while (pending) { kotlinx.coroutines.delay(15_000); if (pending) push() } }
    var busy by remember { mutableStateOf(false) }
    var msg by remember { mutableStateOf("") }
    var ask by remember { mutableStateOf<Ask?>(null) }
    val scroll = rememberScrollState()
    Page(q?.title ?: tl("Quiz"), q?.let { tl("{length} questions · pass mark {pass_percent}%{v}", "length" to it.questions.size, "pass_percent" to it.pass_percent,
                                             "v" to if (it.kind == "course") " · course test" else "") }.orEmpty(), back, scroll = scroll) {
        Loaded(quiz) { qz ->
            val res = out
            if (res == null && resumed) Quiet(tl("Welcome back: your answers so far are restored. This test is not submitted yet."))
            if (res == null && qz.attempts > 0) Row(verticalAlignment = Alignment.CenterVertically) {
                Quiet(tl("You have tried this {n}. Best {best}% · latest {latest}%.", "n" to pl(qz.attempts, "time"), "best" to qz.best, "latest" to qz.latest), Modifier.weight(1f))
                TextButton(onClick = { openAttempts(id) }) { Text(tl("See your attempts")) }
            }
            if (res != null) {
                Panel {
                    Text("${res.score} / ${res.total} · ${res.percent}%", style = MaterialTheme.typography.headlineSmall)
                    Quiet(tl("Pass mark {pass}%.", "pass" to res.pass_percent) + if (res.summary.isNotEmpty()) " " + res.summary else "")
                    Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        res.attempt_id?.let { aid -> Button(onClick = { openAttempt(aid) }) { Text(tl("Review answers")) } }
                        OutlinedButton(onClick = { tick++ }) { Text(tl("Try again")) }
                    }
                    TextButton(onClick = back) { Text(tl("Back")) }
                }
                if (res.areas.isNotEmpty()) { SectionTitle(tl("What you are good at and what to revisit")); AreaList(res.areas, onStudy = openTopic) }
            }
            qz.questions.forEachIndexed { i, x ->
                Panel {
                    Text(tl("Question") + " " + (i + 1), fontWeight = FontWeight.SemiBold)
                    MathMd(x.text); QImage(x.image, tl("Picture for question {pos}", "pos" to i + 1))
                    x.options.forEachIndexed { k, o ->
                        val r = res?.results?.getOrNull(i)
                        val st = if (r != null) when { k == r.correct || (r.ok && k == r.chosen) -> OptState.Ok; k == r.chosen -> OptState.Bad; else -> OptState.Plain }
                                 else if (picks.getOrNull(i) == k) OptState.Picked else OptState.Plain
                        Option(k, o, x.option_images.getOrElse(k) { "" }, st, onClick = if (res == null) ({ picks[i] = k; ver += 1; pending = true; keepHere(); push() }) else null)
                    }
                    res?.results?.getOrNull(i)?.explanation?.takeIf { it.isNotBlank() }?.let { MathMd(it) }
                }
            }
            if (res == null && qz.questions.isNotEmpty()) {
                if (msg.isNotEmpty()) Text(msg, color = MaterialTheme.colorScheme.error)
                val submit = { scope.launch {
                    busy = true; msg = ""
                    try {
                        val body = buildJsonObject { put("answers", JsonArray(picks.map { it?.let(::JsonPrimitive) ?: JsonNull })); put("request_id", sitting) }
                        out = a.send("POST", "/quizzes/$id/attempt", body, AttemptOut.serializer()); prefs.edit().remove(key).apply(); pending = false; kept = ""; scroll.scrollTo(0)
                    } catch (e: Exception) { msg = e.message.orEmpty() }
                    busy = false
                } }
                Button(enabled = !busy, modifier = Modifier.fillMaxWidth(), onClick = {
                    val n = picks.size; val blank = picks.count { it == null }
                    val counts = tl("Answered") + ": ${n - blank} · " + tl("Unanswered") + ": $blank · " + tl("Total") + ": $n"
                    val warn = when (blank) { 0 -> tl("You have answered every question."); 1 -> tl("You have 1 unanswered question. It will be marked wrong.")
                                              else -> tl("You have {n} unanswered questions. They will be marked wrong.", "n" to blank) }
                    ask = Ask(tl("Submit your test?"), counts + "\n\n" + warn, tl("Confirm submission"), cancel = tl("Go back")) { if (!busy) submit() }
                }) { Text(if (busy) tl("Checking…") else tl("Submit answers")) }
                val left = picks.count { it == null }
                if (left > 0) Quiet("$left " + tl("unanswered. Blank answers count as wrong."))
                Quiet(when (kept) {
                    "submitted" -> tl("This test was already submitted, in another tab or on another device. Go back and open it again to see your result.")
                    "saving" -> tl("Saving your answers…")
                    "offline" -> tl("Not saved yet: you seem to be offline. Your answers are kept on this device and will be saved when you are back online.")
                    else -> tl("Your answers are saved as you go.") })
            }
            if (qz.questions.isEmpty()) Quiet(stringResource(R.string.no_questions))
        }
    }
    AskDialog(ask) { ask = null }
}
