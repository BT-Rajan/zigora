package app.zigora.ui

import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import app.zigora.R
import app.zigora.data.CourseRef
import app.zigora.data.I18n
import app.zigora.data.InviteOut
import app.zigora.data.Offer
import app.zigora.data.OfferList
import app.zigora.data.Roster
import app.zigora.data.Sent
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// A teacher's offered courses on the phone, as on the web: offer one, invite students and decide on requests, keep, suspend, complete or release
// a student, write to the course's students (with a file), repeat, pause, cancel or archive it. Content is edited on the website.

private fun stateLabel(s: String) = when (s) { "upcoming" -> tl("Starts soon"); "running" -> tl("Running"); "paused" -> tl("Paused"); "ended" -> tl("Ended"); "cancelled" -> tl("Cancelled"); "archived" -> tl("Archived"); else -> s }
private fun datesOf(c: Offer) = if (c.starts_on == null && c.ends_on == null) tl("No fixed dates")
    else listOfNotNull(c.starts_on?.let { tl("from {date}", "date" to day(it)) }, c.ends_on?.let { tl("to {date}", "date" to day(it)) }).joinToString(" ")
private fun accessOf(c: Offer) = if (c.access == "open") tl("Open to anyone") else if (c.applications) tl("By invitation, or ask to join") else tl("By invitation only")

@Composable
fun OfferedScreen(openCourse: (Int) -> Unit, openStruggles: (() -> Unit)? = null) {
    val a = api(); val scope = rememberCoroutineScope()
    val l = rememberLoad("my-offers") { get("/offered", OfferList.serializer()) }
    var form by remember { mutableStateOf(false) }
    Page(tl("Offered courses")) {
        Quiet(tl("Courses you run yourself. Only the students on a course's list see it: you invite them, accept those who ask, or open it to anyone."))
        if (!form) Button(onClick = { form = true }, modifier = Modifier.fillMaxWidth()) { Text(tl("Offer a course")) }
        else OfferForm(null, close = { form = false }) { c -> form = false; l.reload(); openCourse(c.id) }
        openStruggles?.let { RowLink(tl("Where students struggle"), "", onClick = it) }
        Loaded(l) { d ->
            if (d.items.isEmpty()) Quiet(tl("No offered courses yet."), Modifier.padding(top = 8.dp))
            d.items.forEach { c ->
                ListRow(c.name, listOf(stateLabel(c.state), datesOf(c), tl("{n} enrolled", "n" to (c.counts["active"] ?: 0)),
                    (c.counts["invited"] ?: 0).takeIf { it > 0 }?.let { tl("{n} invited", "n" to it) }.orEmpty(),
                    (c.counts["applied"] ?: 0).takeIf { it > 0 }?.let { tl("{n} asking to join", "n" to it) }.orEmpty()).filter { it.isNotEmpty() }.joinToString(" · "), onClick = { openCourse(c.id) })
            }
        }
    }
}

/** the course's details: name, about, dates and who may join (a new course, or a change) */
@Composable
fun OfferForm(c: Offer?, close: () -> Unit, done: (Offer) -> Unit) {
    val a = api(); val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(c?.name.orEmpty()) }; var about by remember { mutableStateOf(c?.about.orEmpty()) }
    var start by remember { mutableStateOf(c?.starts_on.orEmpty()) }; var end by remember { mutableStateOf(c?.ends_on.orEmpty()) }
    var access by remember { mutableStateOf(c?.access ?: "enroll") }; var apps by remember { mutableStateOf(c?.applications ?: true) }
    var busy by remember { mutableStateOf(false) }; var err by remember { mutableStateOf("") }
    Panel {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(if (c == null) tl("Offer a course") else tl("Course details"), style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(name, { name = it.take(150) }, Modifier.fillMaxWidth(), label = { Text(tl("Course name")) }, singleLine = true)
            OutlinedTextField(about, { about = it.take(4000) }, Modifier.fillMaxWidth(), minLines = 2, label = { Text(tl("What it is about (optional)")) })
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(start, { start = it.take(10) }, Modifier.weight(1f), label = { Text(tl("Starts (optional)")) }, placeholder = { Text("2026-12-01") }, singleLine = true)
                OutlinedTextField(end, { end = it.take(10) }, Modifier.weight(1f), label = { Text(tl("Ends (optional)")) }, placeholder = { Text("2027-01-15") }, singleLine = true)
            }
            Text(tl("Who may join"), style = MaterialTheme.typography.labelMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(access == "enroll", { access = "enroll" }, { Text(tl("Students I accept")) }); FilterChip(access == "open", { access = "open" }, { Text(tl("Anyone, at once")) })
            }
            if (access == "enroll") Row(Modifier.fillMaxWidth().toggleable(apps, role = Role.Checkbox) { apps = it }, verticalAlignment = Alignment.CenterVertically) {
                Checkbox(apps, null); Text(tl("Students may ask to join (you decide within 48 hours)"))
            }
            if (err.isNotEmpty()) Text(err, color = MaterialTheme.colorScheme.error)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(enabled = !busy && name.trim().length >= 2, onClick = { scope.launch {
                    busy = true; err = ""
                    try {
                        val body = buildJsonObject { put("name", name.trim()); put("about", about.trim()); put("starts_on", start.trim().ifEmpty { null }); put("ends_on", end.trim().ifEmpty { null }); put("access", access); put("applications", apps) }
                        done(a.send(if (c == null) "POST" else "PUT", if (c == null) "/offered" else "/offered/${c.id}", body, Offer.serializer()))
                    } catch (e: Exception) { err = I18n.srv(e.message) }
                    busy = false
                } }) { Text(if (c == null) tl("Offer the course") else tl("Save")) }
                TextButton(onClick = close) { Text(stringResource(R.string.cancel)) }
            }
        }
    }
}

private val ROSTER_GROUPS = listOf("applied" to "Asking to join", "invited" to "Invited", "active" to "Enrolled", "suspended" to "Suspended", "completed" to "Completed",
                                   "released" to "Released", "declined" to "Declined", "expired" to "Lapsed after 48 hours", "cancelled" to "Cancelled")
private val ROSTER_ACTS = mapOf("applied" to listOf("approve" to "Accept", "decline" to "Decline"), "active" to listOf("suspend" to "Suspend", "complete" to "Mark completed", "release" to "Release"),
                                "suspended" to listOf("retain" to "Restore", "release" to "Release"), "completed" to listOf("release" to "Release"), "invited" to listOf("revoke" to "Take back the invitation"))

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun OfferDetailScreen(id: Int, back: () -> Unit) {
    val a = api(); val scope = rememberCoroutineScope()
    val l = rememberLoad("roster", id) { get("/offered/$id/roster", Roster.serializer()) }
    var tab by rememberSaveable { mutableStateOf("students") }
    var who by remember { mutableStateOf("") }; var msg by remember { mutableStateOf("") }; var busy by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }; var confirm by remember { mutableStateOf<String?>(null) }
    var rep by remember { mutableStateOf<Triple<String, String, String>?>(null) }; var repSame by remember { mutableStateOf(true) }
    fun run(block: suspend () -> Unit) = scope.launch { busy = true; msg = ""; try { block(); l.reload() } catch (e: Exception) { msg = I18n.srv(e.message) }; busy = false }
    Loaded(l) { d ->
        val c = d.course; val live = c.state != "cancelled" && c.state != "archived"
        Page(c.name, datesOf(c) + " · " + accessOf(c), back = back) {
            Quiet(stateLabel(c.state))
            if (msg.isNotEmpty()) Text(msg, color = MaterialTheme.colorScheme.primary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("students" to tl("Students"), "message" to tl("Write to students"), "course" to tl("Course")).forEach { (k, t) -> FilterChip(tab == k, { tab = k }, { Text(t) }) }
            }
            when (tab) {
                "students" -> {
                    if (live) Panel {
                        OutlinedTextField(who, { who = it }, Modifier.fillMaxWidth(), minLines = 2, label = { Text(tl("Invite students")) }, placeholder = { Text(tl("Emails or usernames, one per line")) })
                        Quiet(tl("Each gets an email and has 48 hours to accept."))
                        Button(enabled = !busy && who.isNotBlank(), modifier = Modifier.padding(top = 6.dp), onClick = { run {
                            val r = a.send("POST", "/offered/$id/invite", buildJsonObject { put("who", JsonArray(who.split(Regex("[\\s,;]+")).filter { it.isNotBlank() }.map { JsonPrimitive(it) })) }, InviteOut.serializer())
                            msg = listOfNotNull(r.invited.takeIf { it > 0 }?.let { if (it == 1) tl("1 invitation sent") else tl("{n} invitations sent", "n" to it) },
                                r.not_found.takeIf { it.isNotEmpty() }?.let { tl("Not found: {list}", "list" to it.joinToString(", ")) },
                                r.already.takeIf { it.isNotEmpty() }?.let { tl("Already on the list: {list}", "list" to it.joinToString(", ")) }).joinToString(" · ").ifEmpty { tl("Nothing to send") }
                            who = ""
                        } }) { Text(tl("Send invitations")) }
                    }
                    ROSTER_GROUPS.forEach { (g, label) ->
                        val rows = d.items.filter { it.status == g }
                        if (rows.isNotEmpty()) {
                            SectionTitle(tl(label) + " (${rows.size})")
                            rows.forEach { e ->
                                Panel {
                                    Text(e.name, style = MaterialTheme.typography.titleSmall)
                                    Quiet(e.who + (e.expires_at?.let { " · " + hoursLeftOf(it) } ?: ""))
                                    if (live) FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        ROSTER_ACTS[g].orEmpty().forEach { (act, al) -> TextButton(enabled = !busy, onClick = { run { a.raw("POST", "/enrolments/${e.id}", buildJsonObject { put("action", act) }) } }) { Text(tl(al)) } }
                                    }
                                }
                            }
                        }
                    }
                    if (d.items.isEmpty()) Quiet(tl("Nobody on the list yet."))
                }
                "message" -> WriteStudentsBox(id)
                else -> {
                    if (c.about.isNotEmpty()) MathMd(c.about)
                    if (editing) OfferForm(c, close = { editing = false }) { editing = false; l.reload() }
                    else if (live) OutlinedButton(onClick = { editing = true }, modifier = Modifier.fillMaxWidth()) { Text(tl("Change the details, dates or who may join")) }
                    if (live) OutlinedButton(enabled = !busy, modifier = Modifier.fillMaxWidth(), onClick = { if (c.state == "paused") run { a.raw("POST", "/offered/$id/pause", buildJsonObject { put("paused", false) }); msg = tl("Resumed. Students are told.") } else confirm = "pause" }) {
                        Text(if (c.state == "paused") tl("Resume the course") else tl("Pause the course")) }
                    if (rep == null) OutlinedButton(onClick = { rep = Triple(c.name, "", "") }, modifier = Modifier.fillMaxWidth()) { Text(tl("Repeat this course")) }
                    else rep?.let { (n, s0, e0) ->
                        Panel {
                            Text(tl("Repeat this course"), style = MaterialTheme.typography.titleMedium)
                            Quiet(tl("A new run with the same units, topics and quizzes. Change anything there afterwards."))
                            OutlinedTextField(n, { rep = Triple(it, s0, e0) }, Modifier.fillMaxWidth(), label = { Text(tl("Course name")) }, singleLine = true)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(s0, { rep = Triple(n, it.take(10), e0) }, Modifier.weight(1f), label = { Text(tl("Starts (optional)")) }, singleLine = true)
                                OutlinedTextField(e0, { rep = Triple(n, s0, it.take(10)) }, Modifier.weight(1f), label = { Text(tl("Ends (optional)")) }, singleLine = true)
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { FilterChip(repSame, { repSame = true }, { Text(tl("Invite the same students")) }); FilterChip(!repSame, { repSame = false }, { Text(tl("Start with nobody")) }) }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(enabled = !busy, onClick = { run {
                                    val r = a.send("POST", "/offered/$id/repeat", buildJsonObject { put("name", n); put("starts_on", s0.ifEmpty { null }); put("ends_on", e0.ifEmpty { null }); put("students", if (repSame) "same" else "none") }, Offer.serializer())
                                    msg = tl("New run made.") + " " + r.name; rep = null
                                } }) { Text(tl("Make the new run")) }
                                TextButton(onClick = { rep = null }) { Text(stringResource(R.string.cancel)) }
                            }
                        }
                    }
                    if (c.state != "cancelled") OutlinedButton(enabled = !busy, modifier = Modifier.fillMaxWidth(), onClick = { run { a.raw("PUT", "/courses/$id/archive", buildJsonObject { put("archived", c.state != "archived") }) } }) {
                        Text(if (c.state == "archived") tl("Restore from the archive") else tl("Archive")) }
                    if (live) TextButton(onClick = { confirm = "cancel" }) { Text(tl("Cancel the course"), color = MaterialTheme.colorScheme.error) }
                    Quiet(tl("Units and topics are edited on the website. Classes and announcements, questions and where students struggle are on their own tabs."))
                }
            }
        }
    }
    confirm?.let { k ->
        AlertDialog(onDismissRequest = { confirm = null },
            title = { Text(if (k == "pause") tl("Pause this course?") else tl("Cancel this course?")) },
            text = { Text(if (k == "pause") tl("Students keep their place but can't open it, and nobody can join, until you resume it. They are told both times.")
                          else tl("Its students lose it, invitations and requests are cancelled, and its classes still to come are cancelled. Everyone is told. This can't be undone.")) },
            confirmButton = { TextButton(onClick = { confirm = null; run {
                if (k == "pause") { a.raw("POST", "/offered/$id/pause", buildJsonObject { put("paused", true) }); msg = tl("Paused. Students are told.") } else a.raw("POST", "/offered/$id/cancel")
            } }) { Text(if (k == "pause") tl("Pause") else tl("Cancel the course")) } },
            dismissButton = { TextButton(onClick = { confirm = null }) { Text(stringResource(R.string.cancel)) } })
    }
}

private fun hoursLeftOf(iso: String): String {
    val h = ((java.time.Instant.parse(iso).toEpochMilli() - System.currentTimeMillis()) / 3_600_000L).coerceAtLeast(0)
    return if (h < 1) tl("less than an hour left") else if (h == 1L) tl("1 hour left") else tl("{n} hours left", "n" to h)
}

/** a message to every student of a course (or the ones ticked on the web), with a file if the teacher adds one */
@Composable
fun WriteStudentsBox(cid: Int) {
    val a = api(); val scope = rememberCoroutineScope(); val ctx = LocalContext.current
    var subject by remember { mutableStateOf("") }; var text by remember { mutableStateOf("") }
    var file by remember { mutableStateOf<Pair<String, String>?>(null) }; var busy by remember { mutableStateOf(false) }; var msg by remember { mutableStateOf("") }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uri ?: return@rememberLauncherForActivityResult
        runCatching {
            val name = ctx.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else null } ?: "file"
            val bytes = ctx.contentResolver.openInputStream(uri)!!.use { it.readBytes() }
            if (bytes.size > 15 * 1024 * 1024) { msg = tl("Keep the file under 15 MB"); return@runCatching }
            file = name to ("data:application/octet-stream;base64," + android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP))
        }.onFailure { msg = tl("That file could not be read") }
    }
    Panel {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(subject, { subject = it.take(200) }, Modifier.fillMaxWidth(), label = { Text(tl("Subject")) }, singleLine = true)
            OutlinedTextField(text, { text = it.take(1000) }, Modifier.fillMaxWidth(), minLines = 3, label = { Text(tl("Message")) })
            file?.let { (n, _) -> Row(verticalAlignment = Alignment.CenterVertically) { Text("📎 $n", Modifier.weight(1f)); TextButton(onClick = { file = null }) { Text(tl("Remove the file")) } } }
                ?: TextButton(onClick = { pick.launch(arrayOf("application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.*", "application/vnd.ms-*", "text/*", "image/*", "application/zip")) }) { Text(tl("Attach material")) }
            Quiet(tl("To every student on the course, or tick some below.").substringBefore(",") + ". " + tl("Each student gets it in My questions and can answer you there."))
            if (msg.isNotEmpty()) Text(msg, color = MaterialTheme.colorScheme.primary)
            Button(enabled = !busy && subject.trim().length >= 3 && text.trim().length >= 3, onClick = { scope.launch {
                busy = true; msg = ""
                try {
                    val r = a.send("POST", "/courses/$cid/message", buildJsonObject { put("subject", subject.trim()); put("text", text.trim())
                        file?.let { (n, data) -> put("file", buildJsonObject { put("name", n); put("data", data) }) } }, Sent.serializer())
                    msg = if (r.sent == 1) tl("Sent to 1 student") else tl("Sent to {n} students", "n" to r.sent); subject = ""; text = ""; file = null
                } catch (e: Exception) { msg = I18n.srv(e.message) }
                busy = false
            } }) { Text(tl("Send")) }
        }
    }
}
