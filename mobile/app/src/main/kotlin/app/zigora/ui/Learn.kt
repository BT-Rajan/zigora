package app.zigora.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.zigora.data.AiStatus
import app.zigora.data.I18n
import app.zigora.data.Learning
import app.zigora.data.Step
import app.zigora.data.TopicFull
import kotlinx.coroutines.launch

/** the AI steps of a topic, in the order a student walks through them; each comes from the server once and is shared */
private val LEARN_STEPS = listOf("gist", "why", "example", "exam", "check")

/** A topic one step per screen, on a clean screen: the gist, Why?, Example, Exam angle and a Quick check (when the student has AI help and the
 *  topic has notes), then the notes, then "I've learned this". Back and Next at the bottom, a thin line at the top for how far along they are.
 *  "Full page" opens the topic's usual page (highlights, asking the teacher, practice and the rest). */
@Composable
fun LearnScreen(id: Int, back: () -> Unit, fullPage: () -> Unit) {
    val topic = rememberLoad("learn-topic", id) { get("/topics/$id", TopicFull.serializer()) }
    val ai = rememberLoad("ai") { get("/ai/status", AiStatus.serializer()) }
    Surface(Modifier.fillMaxSize()) {
        Loaded(topic) { t ->
            val aiOn = (ai.state as? Load.Ok)?.value?.available == true && (!t.content.isNullOrBlank() || t.my_notes != null)
            val steps = (if (aiOn) LEARN_STEPS else emptyList()) + listOf("notes", "done")
            var i by rememberSaveable(id) { mutableIntStateOf(0) }
            if (i >= steps.size) i = steps.size - 1  // AI status arrived after they moved on
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
                Row(Modifier.fillMaxWidth().padding(start = 4.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = back) { Icon(Icons.Outlined.Close, tl("Close")) }
                    Text(t.title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    TextButton(onClick = fullPage) { Text(tl("Full page")) }
                }
                LinearProgressIndicator(progress = { (i + 1f) / steps.size }, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp))
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState(), reverseScrolling = false).padding(24.dp)) {
                        when (val k = steps[i]) {
                            "gist" -> GistStep(id)
                            "notes" -> NotesStep(t)
                            "done" -> DoneStep(t, back)
                            else -> AiStep(id, k)
                        }
                    }
                }
                Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (i > 0) OutlinedButton(onClick = { i-- }, modifier = Modifier.weight(1f)) { Text(tl("Back")) } else Spacer(Modifier.weight(1f))
                    if (i < steps.size - 1) Button(onClick = { i++ }, modifier = Modifier.weight(1f)) { Text(tl("Next")) }
                    else Button(onClick = back, modifier = Modifier.weight(1f)) { Text(tl("Close")) }
                }
            }
        }
    }
}

/** a step that didn't load: what went wrong, and another try; Next still moves on */
@Composable
private fun StepFailed(message: String, again: () -> Unit) = Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Text(tl("This step didn't load."), style = MaterialTheme.typography.titleMedium)
    Quiet(I18n.srv(message) + " " + tl("You can try again, or go on with Next."))
    TextButton(onClick = again) { Text(tl("Try again")) }
}

@Composable
private fun GistStep(id: Int) {
    val g = rememberLoad("gist", id) { get("/topics/$id/ai/gist", Step.serializer()) }
    when (val st = g.state) {
        is Load.Loading -> Busy()
        is Load.Failed -> StepFailed(st.message, g.reload)
        is Load.Ok -> { val d = st.value.data ?: return
            Text(tl("The gist"), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
            d.list("points").forEach { p -> Row(Modifier.padding(top = 10.dp)) { Text("•  ", style = MaterialTheme.typography.bodyLarge); Md(p) } }
            if (d.str("hook").isNotEmpty()) Hook(d.str("hook"), d.str("hook_answer"))
        }
    }
}

@Composable
private fun AiStep(id: Int, k: String) {
    val r = rememberLoad("learn-$k", id) { get("/topics/$id/ai/$k", Step.serializer()) }
    when (val st = r.state) {
        is Load.Loading -> Busy()
        is Load.Failed -> StepFailed(st.message, r.reload)
        is Load.Ok -> st.value.data?.let { StepCard(id, st.value.id, k, it, student = true, onSimpler = null) }
    }
}

@Composable
private fun NotesStep(t: TopicFull) = Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Text(tl("Notes"), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
    when {
        t.content_format == "interactive" && !t.content.isNullOrBlank() -> Quiet(tl("This topic is an interactive page. Open the full page to use it."))
        !t.content.isNullOrBlank() -> WebContent(t.content!!, t.content_format)
        t.my_notes == null -> Quiet(tl("This topic has no notes yet. Open the full page to bring your own notes."))
    }
    t.my_notes?.let { Text(tl("Your notes"), style = MaterialTheme.typography.titleSmall); WebContent(it) }
}

@Composable
private fun DoneStep(t: TopicFull, back: () -> Unit) = Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
    val a = api(); val scope = rememberCoroutineScope()
    var status by remember(t.id) { mutableStateOf(t.status) }; var msg by remember { mutableStateOf("") }
    Text(tl("That's the topic"), style = MaterialTheme.typography.headlineSmall)
    Quiet(tl("If it made sense, mark it learned. You can always come back to it."))
    if (status == "completed") Quiet(tl("You've marked this topic as learned."))
    else Button(onClick = { scope.launch {
        try { status = a.send("PUT", "/topics/${t.id}/complete", null, Learning.serializer()).status } catch (e: Exception) { msg = e.message.orEmpty() }
    } }, modifier = Modifier.fillMaxWidth()) { Text(tl("I've learned this")) }
    if (msg.isNotEmpty()) Text(msg, color = MaterialTheme.colorScheme.error)
}
