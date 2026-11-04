package app.zigora.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import app.zigora.data.I18n
import app.zigora.data.TopicRes
import app.zigora.data.TopicResList
import coil3.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** S43: the teacher's resources for this topic (its own, its unit's, its course's), inside the topic; documents and videos come through a signed-in download */
@Composable
fun TopicResourcesList(tid: Int) {
    val l = rememberLoad("resources", tid) { runCatching { get("/topics/$tid/resources", TopicResList.serializer()) }.getOrDefault(TopicResList()) }
    val d = (l.state as? Load.Ok)?.value ?: return
    if (d.items.isEmpty()) return
    SectionTitle(tl("Teacher resources"))
    d.items.forEach { ResourceCard(it) }
}

private fun kindLabel(k: String) = when (k) { "note" -> tl("Note"); "example" -> tl("Worked example"); "image" -> tl("Image"); "document" -> tl("Document"); "video" -> tl("Video"); else -> tl("Link") }
private fun levelLabel(l: String) = when (l) { "topic" -> tl("This topic"); "unit" -> tl("This unit"); else -> tl("This course") }

@Composable
private fun ResourceCard(r: TopicRes) {
    var open by remember(r.id) { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf("") }
    val ctx = LocalContext.current; val a = api(); val scope = rememberCoroutineScope()
    Panel(Modifier.padding(bottom = 8.dp), onClick = { if (!open) scope.launch { runCatching { a.raw("POST", "/resources/${r.id}/opened") } }; open = !open }) {  // S45: opening is recorded (only that)
        Column {
            Text(r.title, style = MaterialTheme.typography.titleSmall)
            Quiet(listOfNotNull(kindLabel(r.kind), levelLabel(r.level), if (r.status == "draft") tl("Draft: students can't see it") else null).joinToString(" · "))
            if (open) {
                if (r.description.isNotEmpty()) Quiet(r.description, Modifier.padding(top = 4.dp))
                if (r.body.isNotEmpty()) MathMd(r.body)
                if (r.image.isNotEmpty()) AsyncImage(a.base + r.image, r.title, Modifier.fillMaxWidth().heightIn(max = 360.dp).padding(top = 6.dp))
                if (r.url.isNotEmpty()) OutlinedButton(onClick = { runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(r.url))) } }, modifier = Modifier.padding(top = 6.dp)) {
                    Text(if (r.kind == "video") "▶ " + tl("Watch video") else tl("Open"))
                }
                r.file?.let { f ->
                    OutlinedButton(enabled = !busy, modifier = Modifier.padding(top = 6.dp), onClick = { scope.launch {
                        busy = true; err = ""
                        try {
                            val bytes = a.bytes(f.url)
                            val uri = withContext(Dispatchers.IO) {
                                val dir = java.io.File(ctx.cacheDir, "resources").apply { mkdirs() }
                                val out = java.io.File(dir, f.name.replace(Regex("[^\\w .()-]"), "_").take(80).ifEmpty { "file" }); out.writeBytes(bytes)
                                FileProvider.getUriForFile(ctx, ctx.packageName + ".files", out)
                            }
                            val ext = f.name.substringAfterLast('.', "").lowercase()
                            val type = android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
                            ctx.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, type).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
                        } catch (e: Exception) { err = I18n.srv(e.message) }
                        busy = false
                    } }) { Text((if (f.video) "▶ " else "📎 ") + f.name + " · " + (if (busy) tl("Loading…") else if (f.video) tl("Play") else tl("Download"))) }
                }
                if (err.isNotEmpty()) Text(err, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}
