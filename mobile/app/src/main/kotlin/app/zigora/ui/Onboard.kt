package app.zigora.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.zigora.data.Me
import app.zigora.data.ProgOpts
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** how long the free plan's note stays before it closes by itself (and the student carries on free) */
const val FREE_NOTE_MS = 4000L

@kotlinx.serialization.Serializable private data class ProfileOut(val user: Me)

/** After first signing in, a student who signed up completes their profile once: their course of study (when they aren't placed yet),
 *  then a plan. Free shows a short note that AI use costs the college, with Get Pro or Continue free; it closes by itself after 4 seconds.
 *  done: the updated account, and where to go next ("me" to get Pro, "key" to add an own AI key, null for Home). */
@Composable
fun ProfileSetup(me: Me, done: (Me, String?) -> Unit) {
    val a = api(); val scope = rememberCoroutineScope()
    val planStep = me.plan in setOf("lite", "pro", "own")  // a school student's AI comes from a parent's or teacher's key: no plan to pick
    var step by remember { mutableStateOf(if (me.placed) "plan" else "course") }
    var opts by remember { mutableStateOf(ProgOpts()) }
    var program by remember { mutableStateOf<Int?>(null) }; var sem by remember { mutableStateOf<Int?>(null) }
    var busy by remember { mutableStateOf(false) }; var msg by remember { mutableStateOf("") }
    var freeNote by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { if (!me.placed) opts = runCatching { a.get("/me/places", ProgOpts.serializer()) }.getOrDefault(ProgOpts()) }
    fun finish(plan: String, next: String?) = scope.launch {
        busy = true; msg = ""
        try {
            val r = a.send("PUT", "/me/profile", buildJsonObject { put("program_id", program); put("semester", sem); put("plan", plan) }, ProfileOut.serializer())
            done(r.user, next)
        } catch (e: Exception) { msg = e.message.orEmpty() }
        busy = false
    }
    Surface(Modifier.fillMaxSize()) {
        Column(Modifier.statusBarsPadding().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(tl("Complete your profile"), style = MaterialTheme.typography.headlineSmall)
            Quiet(if (planStep && !me.placed) tl("Two quick choices, then you start learning.") else tl("One quick choice, then you start learning."))
            if (step == "course") {
                SectionTitle(tl("Your course of study"))
                Quiet(tl("Choose your program and where you are in it. Your courses come from it; your admin can change it later."))
                PlacePicker(opts, me.level ?: "college", program, sem) { p, n -> program = p; sem = n }
                Button(enabled = !busy && (program == null || sem != null), modifier = Modifier.fillMaxWidth(),
                       onClick = { if (planStep) step = "plan" else finish("free", null) }) { Text(tl("Continue")) }
            } else {
                SectionTitle(tl("Choose your plan"))
                Panel(onClick = { if (!busy) freeNote = true }) { Column {
                    Text(tl("Free"), style = MaterialTheme.typography.titleMedium)
                    Quiet(tl("A free daily allowance of AI help: a few searches and some minutes of learning with AI each day."))
                } }
                Panel(onClick = { if (!busy) finish("pro", "me") }) { Column {
                    Text(tl("Pro"), style = MaterialTheme.typography.titleMedium)
                    Quiet(tl("No daily limit, diagrams, and asking your teacher. Paid, for as long as you choose."))
                } }
                Panel(onClick = { if (!busy) finish("own", "key") }) { Column {
                    Text(tl("My own AI key"), style = MaterialTheme.typography.titleMedium)
                    Quiet(tl("Use your own key from DeepSeek, ChatGPT, Claude, Qwen or Perplexity: no daily limit, billed to you."))
                } }
                if (!me.placed) TextButton(onClick = { step = "course" }) { Text(tl("Back")) }
            }
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            if (msg.isNotEmpty()) Text(msg, color = MaterialTheme.colorScheme.error)
        }
    }
    if (freeNote) FreeNote(getPro = { freeNote = false; finish("pro", "me") }, goFree = { freeNote = false; finish("free", null) })
}

/** "AI costs us": Get Pro or Continue free. It closes by itself after FREE_NOTE_MS, which counts as continuing free. */
@Composable
fun FreeNote(getPro: () -> Unit, goFree: () -> Unit) {
    var left by remember { mutableFloatStateOf(1f) }
    LaunchedEffect(Unit) { val steps = 40; repeat(steps) { delay(FREE_NOTE_MS / steps); left = 1f - (it + 1f) / steps }; goFree() }
    AlertDialog(onDismissRequest = goFree, title = { Text(tl("AI costs us money")) },
        text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(tl("Each time you use AI, Zigora pays the AI provider. Would you like to pay for Pro, or continue free?"))
            LinearProgressIndicator(progress = { left }, modifier = Modifier.fillMaxWidth())  // how long until it closes by itself
        } },
        confirmButton = { Button(onClick = getPro) { Text(tl("Get Pro")) } },
        dismissButton = { TextButton(onClick = goFree) { Text(tl("Continue free")) } })
}
