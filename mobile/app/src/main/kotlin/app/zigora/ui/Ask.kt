package app.zigora.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import app.zigora.R
import app.zigora.data.I18n
import app.zigora.data.QuestionList
import app.zigora.data.QuestionThread
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Ask the teacher, as on the web: a student's question about a topic (or a phrase in it) goes to the teacher of its course, who answers
// on the web. Not anonymous: the teacher sees who asked. The student's questions are under Saved, each one a short thread.

/** the question box, opened in place: what to ask, and the phrase it is about when it came from "Not clear?" */
@Composable
fun AskTeacherBox(tid: Int, excerpt: String = "", close: (sent: Boolean) -> Unit) {
    val a = api(); val scope = rememberCoroutineScope()
    var text by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf("") }
    Panel {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(tl("Ask my teacher"), style = MaterialTheme.typography.titleMedium)
            if (excerpt.isNotEmpty()) Quiet("“$excerpt”")
            OutlinedTextField(text, { if (it.length <= 1000) text = it }, Modifier.fillMaxWidth(), minLines = 3, label = { Text(tl("Your question")) },
                              placeholder = { Text(tl("What would you like your teacher to explain?")) })
            Quiet(tl("Your teacher sees your name and the topic you ask about."))
            if (err.isNotEmpty()) Text(err, color = MaterialTheme.colorScheme.error)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(enabled = !busy && text.trim().length >= 3, onClick = { scope.launch {
                    busy = true; err = ""
                    try { a.raw("POST", "/topics/$tid/questions", buildJsonObject { put("text", text.trim()); put("excerpt", excerpt) }); close(true) }
                    catch (e: Exception) { err = I18n.srv(e.message) }
                    busy = false
                } }) { Text(if (busy) tl("Sending…") else tl("Send to my teacher")) }
                TextButton(onClick = { close(false) }) { Text(stringResource(R.string.cancel)) }
            }
        }
    }
}

private fun stateLabel(s: String) = when (s) { "answered" -> tl("Answered"); "closed" -> tl("Closed"); else -> tl("Waiting for your teacher") }

/** Saved > Questions: the student's questions, newest first, answered ones they haven't read marked */
@Composable
fun MyQuestions(openQuestion: (Int) -> Unit, sub: (String) -> Unit) {
    val l = rememberLoad("my-questions") { get("/me/questions", QuestionList.serializer()) }
    Loaded(l) { d ->
        sub(pl(d.items.size, "question"))
        if (d.items.isEmpty()) Quiet(tl("No questions yet. On any topic, tap Ask my teacher, or choose it under Not clear? on a phrase you highlighted."), Modifier.padding(top = 12.dp))
        Paged(d.items) { x ->
            ListRow(x.topic, listOf(x.course, if (x.unread) tl("New answer") else stateLabel(x.status)).filter { it.isNotEmpty() }.joinToString(" · "), onClick = { openQuestion(x.id) }) {
                if (x.last.isNotEmpty()) Quiet(x.last, Modifier.padding(top = 4.dp))
            }
        }
    }
}

/** one question's thread: the student's messages on one side, the teacher's on the other; they can reply until it is closed */
@Composable
fun QuestionScreen(id: Int, back: () -> Unit, openTopic: (Int) -> Unit) {
    val a = api(); val scope = rememberCoroutineScope()
    val l = rememberLoad("question", id) { get("/questions/$id", QuestionThread.serializer()) }
    var q by remember(id) { mutableStateOf<QuestionThread?>(null) }
    var text by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf("") }
    var closing by remember { mutableStateOf(false) }
    Loaded(l) { first ->
        val t = q ?: first
        Page(t.topic, listOf(t.course, stateLabel(t.status)).filter { it.isNotEmpty() }.joinToString(" · "), back = back) {
            TextButton(onClick = { openTopic(t.topic_id) }) { Text(tl("Open the topic")) }
            t.excerpt?.takeIf { it.isNotEmpty() }?.let { Quiet("“$it”") }
            t.messages.forEach { m ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (m.mine) Arrangement.End else Arrangement.Start) {
                    Surface(shape = RoundedCornerShape(16.dp), color = if (m.mine) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainerHigh,
                            modifier = Modifier.widthIn(max = 320.dp)) {
                        Column(Modifier.padding(12.dp)) {
                            Text((if (m.mine) tl("You") else m.who) + (m.at?.let { " · " + stamp(it) } ?: ""), style = MaterialTheme.typography.labelSmall,
                                 color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(m.text, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            }
            if (t.status == "closed") Quiet(tl("This question is closed."), Modifier.padding(top = 8.dp))
            else {
                OutlinedTextField(text, { if (it.length <= 1000) text = it }, Modifier.fillMaxWidth().padding(top = 8.dp), minLines = 2, label = { Text(tl("Reply")) })
                if (err.isNotEmpty()) Text(err, color = MaterialTheme.colorScheme.error)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Button(enabled = !busy && text.trim().length >= 3, onClick = { scope.launch {
                        busy = true; err = ""
                        try { q = a.send("POST", "/questions/$id/replies", buildJsonObject { put("text", text.trim()) }, QuestionThread.serializer()); text = "" }
                        catch (e: Exception) { err = I18n.srv(e.message) }
                        busy = false
                    } }) { Text(if (busy) tl("Sending…") else tl("Send")) }
                    OutlinedButton(onClick = { closing = true }) { Text(tl("Close the question")) }
                }
            }
        }
        if (closing) AlertDialog(onDismissRequest = { closing = false }, title = { Text(tl("Close this question?")) },
            text = { Text(tl("Nobody can reply after this. A new question can be asked from the topic.")) },
            confirmButton = { TextButton(onClick = { closing = false; scope.launch {
                try { q = a.send("POST", "/questions/$id/close", null, QuestionThread.serializer()) } catch (e: Exception) { err = I18n.srv(e.message) }
            } }) { Text(tl("Close it")) } },
            dismissButton = { TextButton(onClick = { closing = false }) { Text(stringResource(R.string.cancel)) } })
    }
}
