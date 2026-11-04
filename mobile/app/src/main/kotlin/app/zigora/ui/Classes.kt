package app.zigora.ui

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import app.zigora.R
import app.zigora.data.Ann
import app.zigora.data.AnnList
import app.zigora.data.I18n
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Classes and announcements, as on the web: a teacher posts a note to a course or schedules a class with a video link (Google Meet, Zoom);
// students join from here when it starts. Teachers post from here too.

private fun whenOf(a: Ann): String = a.starts_at?.let { stamp(it) + " · " + tl("{n} min", "n" to (a.minutes ?: 60)) }.orEmpty()
private fun stateOf(s: String?) = when (s) { "live" -> tl("Starting now"); "upcoming" -> tl("Coming up"); "ended" -> tl("Ended"); "cancelled" -> tl("Cancelled"); else -> "" }

@Composable
fun AnnCard(a: Ann, cancel: ((Ann) -> Unit)? = null, move: ((Ann) -> Unit)? = null) {
    val ctx = LocalContext.current; val api = api(); val scope = rememberCoroutineScope()
    var who by remember(a.id) { mutableStateOf(false) }
    Panel {
        Text((if (a.kind == "class") tl("Class") else tl("Announcement")) + " · " + a.course + stateOf(a.status).takeIf { it.isNotEmpty() }?.let { " · $it" }.orEmpty(),
             style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        Text(a.title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 2.dp))
        if (a.kind == "class") Quiet(whenOf(a) + (a.week?.let { " · " + tl("Weekly, session {n} of {of}", "n" to it.n, "of" to it.of) } ?: ""))
        if (a.body.isNotEmpty()) MathMd(a.body)
        Quiet(listOf(a.by, a.at?.let { stamp(it) }.orEmpty()).filter { it.isNotEmpty() }.joinToString(" · "), Modifier.padding(top = 4.dp))
        val joinable = a.link != null && a.status != "ended"
        val canCancel = cancel != null && a.can_edit && a.status != "cancelled" && a.status != "ended"
        val canMove = move != null && a.can_edit && a.kind == "class" && a.status == "upcoming"
        if (joinable || canCancel || canMove) Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            if (joinable) {
                val open = { scope.launch { runCatching { api.raw("POST", "/announcements/${a.id}/join") } }  // counted for the teacher
                             runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, a.link!!.toUri())) }; Unit }
                if (a.status == "live") Button(onClick = open) { Text(tl("Join the class")) } else OutlinedButton(onClick = open) { Text(tl("Join the class")) }
            }
            androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
            if (canCancel || canMove) androidx.compose.foundation.layout.Box {  // the teacher's changes, one tap away, not a row of buttons
                var menu by remember(a.id) { mutableStateOf(false) }
                androidx.compose.material3.IconButton(onClick = { menu = true }) { androidx.compose.material3.Icon(androidx.compose.material.icons.Icons.Filled.MoreVert, tl("More options")) }
                androidx.compose.material3.DropdownMenu(menu, { menu = false }) {
                    if (canMove) androidx.compose.material3.DropdownMenuItem(text = { Text(tl("Change the time")) }, onClick = { menu = false; move!!(a) })
                    if (canCancel) androidx.compose.material3.DropdownMenuItem(text = { Text(if (a.kind == "class") tl("Cancel the class") else tl("Withdraw"), color = MaterialTheme.colorScheme.error) },
                                                                            onClick = { menu = false; cancel!!(a) })
                }
            }
        }
        val joins = a.joins
        if (joins != null && a.status != "upcoming") {
            TextButton(onClick = { who = !who }) { Text(tl("Tapped Join: {n} of {of}", "n" to joins.size, "of" to a.class_size)) }
            if (who) Quiet((if (joins.isEmpty()) tl("Nobody yet.") else joins.joinToString(", ") { it.name }) + " " + tl("Zigora counts who tapped Join; it can't see who stayed in the call."))
        }
    }
}

/** Home: the next class, a tap from joining, and the way to everything posted */
@Composable
fun NextClassCard(openClasses: () -> Unit) {
    val l = rememberLoad("next-class") { runCatching { get("/announcements?limit=10", AnnList.serializer()) }.getOrDefault(AnnList()) }
    val d = (l.state as? Load.Ok)?.value ?: return
    val ctx = LocalContext.current; androidx.compose.runtime.LaunchedEffect(d) { app.zigora.ClassAlarms.sync(ctx, d.upcoming) }
    if (d.items.isEmpty()) return
    d.upcoming.firstOrNull()?.let { AnnCard(it) }
    RowLink(tl("Classes and announcements"), d.items.firstOrNull { it.kind == "note" }?.let { it.course + ": " + it.title }.orEmpty(), onClick = openClasses)
}

@Composable
fun ClassesScreen(back: (() -> Unit)?) {
    val a = api(); val scope = rememberCoroutineScope(); val ctx = LocalContext.current
    val l = rememberLoad("classes") { get("/announcements", AnnList.serializer()) }
    var form by remember { mutableStateOf<Map<String, String>?>(null) }
    var busy by remember { mutableStateOf(false) }
    var msg by remember { mutableStateOf("") }
    var cancelling by remember { mutableStateOf<Ann?>(null) }
    var moving by remember { mutableStateOf<Ann?>(null) }
    moving?.let { x ->
        val start = remember(x.id) { runCatching { java.time.Instant.parse(x.starts_at).atZone(java.time.ZoneId.systemDefault()) }.getOrNull() }
        var day by remember(x.id) { mutableStateOf(start?.toLocalDate()?.toString().orEmpty()) }
        var at by remember(x.id) { mutableStateOf(start?.toLocalTime()?.toString()?.take(5).orEmpty()) }
        var mins by remember(x.id) { mutableStateOf((x.minutes ?: 60).toString()) }
        var link by remember(x.id) { mutableStateOf(x.link.orEmpty()) }
        var err by remember(x.id) { mutableStateOf("") }
        AlertDialog(onDismissRequest = { moving = null }, title = { Text(tl("Change the class time")) },
            text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Quiet(x.title)
                OutlinedTextField(day, { day = it.take(10) }, Modifier.fillMaxWidth(), label = { Text(tl("Date")) }, singleLine = true)
                OutlinedTextField(at, { at = it.take(5) }, Modifier.fillMaxWidth(), label = { Text(tl("Time")) }, singleLine = true)
                OutlinedTextField(mins, { mins = it.filter(Char::isDigit).take(3) }, Modifier.fillMaxWidth(), label = { Text(tl("Length (minutes)")) }, singleLine = true)
                OutlinedTextField(link, { link = it.trim() }, Modifier.fillMaxWidth(), label = { Text(tl("Video link")) }, singleLine = true)
                if (err.isNotEmpty()) Text(err, color = MaterialTheme.colorScheme.error)
            } },
            confirmButton = { TextButton(onClick = { scope.launch {
                try { a.raw("PUT", "/announcements/${x.id}", buildJsonObject { put("day", day); put("at", at); put("minutes", mins.toIntOrNull() ?: 60); put("link", link) }); moving = null; l.reload() }
                catch (e: Exception) { err = I18n.srv(e.message) }
            } }) { Text(tl("Move the class")) } },
            dismissButton = { TextButton(onClick = { moving = null }) { Text(stringResource(R.string.cancel)) } })
    }
    Page(tl("Classes and announcements"), back = back) {
        Loaded(l) { d ->
            androidx.compose.runtime.LaunchedEffect(d) { app.zigora.ClassAlarms.sync(ctx, d.upcoming) }  // the 10-minute reminders
            if (d.can_post && form == null) Button(onClick = { msg = ""; form = mapOf("kind" to "class", "course" to (d.courses.firstOrNull()?.id?.toString() ?: ""), "title" to "", "body" to "",
                "day" to java.time.LocalDate.now().toString(), "at" to "18:00", "minutes" to "60", "link" to "", "repeat" to "", "weeks" to "8") }, modifier = Modifier.fillMaxWidth()) { Text(tl("Schedule a class or post an announcement")) }
            form?.let { f ->
                val set = { k: String, v: String -> form = f + (k to v) }
                Panel {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(f["kind"] == "class", { set("kind", "class") }, { Text(tl("A class")) })
                            FilterChip(f["kind"] == "note", { set("kind", "note") }, { Text(tl("An announcement")) })
                        }
                        Text(tl("Course"), style = MaterialTheme.typography.labelMedium)
                        androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            d.courses.forEach { c -> FilterChip(f["course"] == c.id.toString(), { set("course", c.id.toString()) }, { Text(c.name) }) }
                        }
                        OutlinedTextField(f["title"]!!, { set("title", it.take(200)) }, Modifier.fillMaxWidth(), label = { Text(tl("Title")) }, singleLine = true)
                        if (f["kind"] == "class") {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(f["day"]!!, { set("day", it) }, Modifier.weight(1f), label = { Text(tl("Date")) }, placeholder = { Text("2026-11-20") }, singleLine = true)
                                OutlinedTextField(f["at"]!!, { set("at", it) }, Modifier.weight(1f), label = { Text(tl("Time")) }, placeholder = { Text("18:00") }, singleLine = true)
                            }
                            OutlinedTextField(f["minutes"]!!, { set("minutes", it.filter(Char::isDigit).take(3)) }, Modifier.fillMaxWidth(), label = { Text(tl("Length (minutes)")) }, singleLine = true)
                            Row(Modifier.fillMaxWidth().toggleable(f["repeat"] == "1", role = androidx.compose.ui.semantics.Role.Checkbox) { set("repeat", if (it) "1" else "") },
                                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {  // the whole row ticks the box
                                androidx.compose.material3.Checkbox(f["repeat"] == "1", null); Text(tl("Repeat every week"))
                            }
                            if (f["repeat"] == "1") {
                                OutlinedTextField(f["weeks"]!!, { set("weeks", it.filter(Char::isDigit).take(2)) }, Modifier.fillMaxWidth(), label = { Text(tl("How many weeks")) }, singleLine = true)
                                Quiet(tl("Every session goes into the calendar. Students are told once, for the whole series."))
                            }
                            OutlinedTextField(f["link"]!!, { set("link", it.trim()) }, Modifier.fillMaxWidth(), label = { Text(tl("Video link")) }, placeholder = { Text("https://meet.google.com/…") }, singleLine = true)
                            Quiet(tl("Make a Google Meet (or Zoom) link, then paste it here. Students join from Zigora when the class starts."))
                            TextButton(onClick = { runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, "https://meet.google.com/new".toUri())) } }) { Text(tl("Make a Google Meet link")) }
                        }
                        OutlinedTextField(f["body"]!!, { set("body", it.take(4000)) }, Modifier.fillMaxWidth(), minLines = 3,
                                          label = { Text(if (f["kind"] == "class") tl("What to bring or prepare (optional)") else tl("Message")) })
                        if (msg.isNotEmpty()) Text(msg, color = MaterialTheme.colorScheme.error)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(enabled = !busy && f["title"]!!.trim().length >= 3 && (f["kind"] == "note" || f["link"]!!.isNotEmpty()), onClick = { scope.launch {
                                busy = true; msg = ""
                                try {
                                    a.raw("POST", "/announcements", buildJsonObject { put("course_id", f["course"]!!.toIntOrNull() ?: 0); put("kind", f["kind"]!!); put("title", f["title"]!!); put("body", f["body"]!!)
                                        put("day", f["day"]!!); put("at", f["at"]!!); put("minutes", f["minutes"]!!.toIntOrNull() ?: 60); put("link", f["link"]!!)
                                        put("weeks", if (f["kind"] == "class" && f["repeat"] == "1") f["weeks"]!!.toIntOrNull() ?: 1 else 1) })
                                    form = null; l.reload()
                                } catch (e: Exception) { msg = I18n.srv(e.message) }
                                busy = false
                            } }) { Text(if (f["kind"] == "class") tl("Schedule the class") else tl("Post")) }
                            TextButton(onClick = { form = null }) { Text(stringResource(R.string.cancel)) }
                        }
                    }
                }
            }
            if (d.upcoming.isNotEmpty()) { SectionTitle(tl("Coming up")); d.upcoming.forEach { x -> AnnCard(x, { cancelling = it }) { m -> moving = m } } }
            val rest = d.items.filter { x -> d.upcoming.none { it.id == x.id } }
            SectionTitle(tl("Recent"))
            if (rest.isEmpty()) Quiet(tl("Nothing posted yet."))
            rest.forEach { x -> AnnCard(x) { cancelling = it } }
        }
    }
    cancelling?.let { x ->
        val stop = { all: Boolean -> cancelling = null; scope.launch { runCatching { a.raw("POST", "/announcements/${x.id}/cancel" + if (all) "?all=true" else "") }; l.reload() }; Unit }
        val more = x.week?.more ?: 0
        AlertDialog(onDismissRequest = { cancelling = null }, title = { Text(if (more > 0) tl("Cancel the weekly class?") else if (x.kind == "class") tl("Cancel this class?") else tl("Withdraw this announcement?")) },
            text = { if (x.kind == "class") Text(tl("It comes out of everyone's calendar, and students and parents are told.")) },
            confirmButton = { Column {
                TextButton(onClick = { stop(false) }) { Text(if (more > 0) tl("Only this session") else if (x.kind == "class") tl("Cancel the class") else tl("Withdraw")) }
                if (more > 0) TextButton(onClick = { stop(true) }) { Text(tl("This and every later session ({n})", "n" to more + 1)) }
            } },
            dismissButton = { TextButton(onClick = { cancelling = null }) { Text(if (more > 0) tl("Keep it") else stringResource(R.string.cancel)) } })
    }
}
