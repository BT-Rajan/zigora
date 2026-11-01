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
import app.zigora.data.QuestionMsg
import app.zigora.data.ClassQuestions
import app.zigora.data.ClassQuestion
import androidx.compose.runtime.LaunchedEffect
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material3.Icon
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Ask the teacher, as on the web: a student's question about a topic (or a phrase in it) goes to the teacher of its course, who answers
// on the web. Not anonymous: the teacher sees who asked. The student's questions are under Saved, each one a short thread.

/** a photo to send with a question or reply: Android's photo picker (no storage permission), shrunk on the phone, shown before sending */
@Composable
fun PhotoPick(photo: String?, set: (String?) -> Unit) {
    val ctx = LocalContext.current; val scope = rememberCoroutineScope()
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> uri?.let { scope.launch { runCatching { shrink(ctx, it) }.getOrNull()?.let { (_, d) -> set(d) } } } }
    if (photo == null) TextButton(onClick = { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
        Icon(Icons.Outlined.PhotoCamera, null, Modifier.size(18.dp)); Text(" " + tl("Add a photo")) }
    else Row(verticalAlignment = Alignment.CenterVertically) {
        val bmp = remember(photo) { runCatching { android.util.Base64.decode(photo.substringAfter(","), 0).let { b -> android.graphics.BitmapFactory.decodeByteArray(b, 0, b.size)?.asImageBitmap() } }.getOrNull() }
        bmp?.let { Image(it, tl("Your photo"), Modifier.size(96.dp).clip(RoundedCornerShape(10.dp))) }
        TextButton(onClick = { set(null) }) { Text(tl("Remove the photo")) }
    }
}

/** one message: its text (maths shown as the web shows it) and its photo */
@Composable
fun MsgBody(m: QuestionMsg) {
    if (m.text.isNotEmpty()) MathMd(m.text)
    m.image?.let { AsyncImage(api().base + it, tl("Photo"), Modifier.fillMaxWidth().heightIn(max = 320.dp).padding(top = 6.dp).clip(RoundedCornerShape(10.dp))) }
}

/** the question box, opened in place: what to ask, a photo if it helps, and the phrase it is about when it came from "Not clear?" */
@Composable
fun AskTeacherBox(tid: Int, excerpt: String = "", close: (sent: Boolean) -> Unit) {
    val a = api(); val scope = rememberCoroutineScope(); val ctx = LocalContext.current
    var text by remember { mutableStateOf("") }
    var photo by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf("") }
    val allow = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { close(true) }  // so the answer can show up as a notification
    var similar by remember { mutableStateOf<List<ClassQuestion>>(emptyList()) }
    LaunchedEffect(text) {  // answers the teacher already shared that look like this question
        val q = listOf(excerpt, text).filter { it.isNotBlank() }.joinToString(" ").trim()
        if (q.split(Regex("\\s+")).size < 2) { similar = emptyList(); return@LaunchedEffect }
        kotlinx.coroutines.delay(500)
        similar = runCatching { a.get("/topics/$tid/similar?q=" + java.net.URLEncoder.encode(q.take(500), "UTF-8"), ClassQuestions.serializer()).items }.getOrDefault(similar)
    }
    Panel {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(tl("Ask my teacher"), style = MaterialTheme.typography.titleMedium)
            if (excerpt.isNotEmpty()) Quiet("“$excerpt”")
            OutlinedTextField(text, { if (it.length <= 1000) text = it }, Modifier.fillMaxWidth(), minLines = 3, label = { Text(tl("Your question")) },
                              placeholder = { Text(tl("What would you like your teacher to explain?")) })
            Quiet(tl("For maths, write it between dollar signs, like \$x^2 + y^2\$."))
            if (similar.isNotEmpty()) {
                Text(tl("Already answered for your class"), style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
                Quiet(tl("Check these first. If one answers it, there's no need to send."))
                similar.forEach { x -> SharedQuestion(x) }
            }
            PhotoPick(photo) { photo = it }
            Quiet(tl("Your teacher sees your name and the topic you ask about."))
            if (err.isNotEmpty()) Text(err, color = MaterialTheme.colorScheme.error)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(enabled = !busy && (text.trim().length >= 3 || (photo != null && text.isBlank())), onClick = { scope.launch {
                    busy = true; err = ""
                    try {
                        a.raw("POST", "/topics/$tid/questions", buildJsonObject { put("text", text.trim()); put("excerpt", excerpt); put("photo", photo.orEmpty()) })
                        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) allow.launch(Manifest.permission.POST_NOTIFICATIONS)
                        else close(true)
                    } catch (e: Exception) { err = I18n.srv(e.message) }
                    busy = false
                } }) { Text(if (busy) tl("Sending…") else tl("Send to my teacher")) }
                TextButton(onClick = { close(false) }) { Text(stringResource(R.string.cancel)) }
            }
        }
    }
}

/** one shared question: what was asked, and its answers a tap away; who asked is never shown */
@Composable
fun SharedQuestion(x: ClassQuestion) {
    var open by remember(x.id) { mutableStateOf(false) }
    Panel(Modifier.padding(bottom = 8.dp)) {
        Text(if (x.mine) tl("Your question") else tl("A student asked"), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        x.excerpt?.takeIf { it.isNotEmpty() }?.let { Quiet("“$it”") }
        x.messages.firstOrNull()?.let { MsgBody(it) }
        val rest = x.messages.drop(1)
        if (!open) TextButton(onClick = { open = true }) { Text(if (rest.size == 1) tl("Show the answer") else tl("Show the {n} replies", "n" to rest.size)) }
        else rest.forEach { m ->
            Text(if (m.teacher) m.who.orEmpty() else tl("A student"), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 10.dp))
            MsgBody(m)
        }
    }
}

/** under a topic: questions the teacher shared with the class, each with its answers; who asked is never shown */
@Composable
fun ClassQuestionsList(tid: Int) {
    val l = rememberLoad("class-q", tid) { runCatching { get("/topics/$tid/class-questions", ClassQuestions.serializer()) }.getOrDefault(ClassQuestions()) }
    val d = (l.state as? Load.Ok)?.value ?: return
    if (d.items.isEmpty()) return
    SectionTitle(tl("Questions from your class"))
    d.items.forEach { x -> SharedQuestion(x) }
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
    var photo by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf("") }
    var closing by remember { mutableStateOf(false) }
    Loaded(l) { first ->
        val t = q ?: first
        Page(t.topic, listOfNotNull(t.course, t.student, stateLabel(t.status)).filter { it.isNotEmpty() }.joinToString(" · "), back = back) {
            TextButton(onClick = { openTopic(t.topic_id) }) { Text(tl("Open the topic")) }
            t.excerpt?.takeIf { it.isNotEmpty() }?.let { Quiet("“$it”") }
            if (t.shared) Quiet(if (t.teacher) tl("Shared with the class") else tl("Your teacher shared this with your class, without your name."))
            t.messages.forEach { m ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (m.mine) Arrangement.End else Arrangement.Start) {
                    Surface(shape = RoundedCornerShape(16.dp), color = if (m.mine) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainerHigh,
                            modifier = Modifier.widthIn(max = 320.dp)) {
                        Column(Modifier.padding(12.dp)) {
                            Text((if (m.mine) tl("You") else m.who.orEmpty()) + (m.at?.let { " · " + stamp(it) } ?: ""), style = MaterialTheme.typography.labelSmall,
                                 color = MaterialTheme.colorScheme.onSurfaceVariant)
                            MsgBody(m)
                        }
                    }
                }
            }
            if (t.teacher && (t.can_share || t.shared)) OutlinedButton(onClick = { scope.launch {
                try { q = a.send("POST", "/questions/$id/share", buildJsonObject { put("shared", !t.shared) }, QuestionThread.serializer()) } catch (e: Exception) { err = I18n.srv(e.message) }
            } }) { Text(if (t.shared) tl("Stop sharing with the class") else tl("Share with the class")) }
            if (t.status == "closed") Quiet(tl("This question is closed."), Modifier.padding(top = 8.dp))
            else {
                OutlinedTextField(text, { if (it.length <= 1000) text = it }, Modifier.fillMaxWidth().padding(top = 8.dp), minLines = 2, label = { Text(if (t.teacher) tl("Your answer") else tl("Reply")) })
                PhotoPick(photo) { photo = it }
                if (err.isNotEmpty()) Text(err, color = MaterialTheme.colorScheme.error)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Button(enabled = !busy && (text.trim().length >= 3 || (photo != null && text.isBlank())), onClick = { scope.launch {
                        busy = true; err = ""
                        try { q = a.send("POST", "/questions/$id/replies", buildJsonObject { put("text", text.trim()); put("photo", photo.orEmpty()) }, QuestionThread.serializer()); text = ""; photo = null }
                        catch (e: Exception) { err = I18n.srv(e.message) }
                        busy = false
                    } }) { Text(if (busy) tl("Sending…") else if (t.teacher) tl("Send answer") else tl("Send")) }
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
