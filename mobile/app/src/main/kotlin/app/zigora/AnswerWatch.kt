package app.zigora

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.zigora.data.I18n
import app.zigora.data.QuestionList
import app.zigora.data.AnnList
import app.zigora.data.QuestionPage
import app.zigora.data.Me
import app.zigora.data.json
import java.util.concurrent.TimeUnit

/** A note on the phone when a teacher answers one of the student's questions: Android looks every 15 minutes or so (its shortest interval
 *  for background work), and each answer is mentioned once. Tapping it opens the question. Only for students, only with notifications allowed. */
class AnswerWatch(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as ZigoraApp
        if (app.store.token == null) return Result.success()
        val role = runCatching { json.decodeFromString(Me.serializer(), app.store.userJson!!).role }.getOrDefault("student")
        if (role == "faculty" || role == "admin") return teacher(app)
        runCatching { classes(app) }
        val items = try { app.api.get("/me/questions", QuestionList.serializer()).items } catch (e: Exception) { return Result.success() }  // try again next time
        val fresh = items.filter { it.unread && "answer:${it.id}:${it.updated}" !in app.store.notified }
        if (fresh.isEmpty()) return Result.success()
        app.store.notified = (app.store.notified + fresh.map { "answer:${it.id}:${it.updated}" }).toList().takeLast(200).toSet()
        if (ContextCompat.checkSelfPermission(app, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return Result.success()
        fresh.take(5).forEach { q ->
            val open = PendingIntent.getActivity(app, q.id, Intent(app, MainActivity::class.java).setAction(OPEN).putExtra("question", q.id)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val n = NotificationCompat.Builder(app, CHANNEL).setSmallIcon(R.drawable.ic_launcher_monochrome)
                .setContentTitle(I18n.t(if (q.message) "A message from your teacher" else "Your teacher answered your question")).setContentText(q.topic + if (q.last.isNotEmpty()) " · " + q.last else "")
                .setStyle(NotificationCompat.BigTextStyle().bigText(q.last)).setContentIntent(open).setAutoCancel(true).build()
            NotificationManagerCompat.from(app).notify(1000 + q.id, n)
        }
        return Result.success()
    }

    private fun allowed(app: ZigoraApp) = ContextCompat.checkSelfPermission(app, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    private fun note(app: ZigoraApp, id: Int, title: String, text: String, extra: (Intent) -> Unit) {
        val open = PendingIntent.getActivity(app, id, Intent(app, MainActivity::class.java).setAction(OPEN).also(extra)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        NotificationManagerCompat.from(app).notify(id, NotificationCompat.Builder(app, CHANNEL).setSmallIcon(R.drawable.ic_launcher_monochrome).setContentTitle(title).setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text)).setContentIntent(open).setAutoCancel(true).build())
    }
    /** a student's or parent's new classes and announcements, each mentioned once */
    private suspend fun classes(app: ZigoraApp) {
        val list = app.api.get("/announcements?limit=30", AnnList.serializer()); ClassAlarms.sync(app, list.upcoming)  // the 10-minute reminders
        val items = list.items.filter { it.status != "cancelled" && it.status != "ended" }
        val fresh = items.filter { "ann:${it.id}" !in app.store.notified }
        if (fresh.isEmpty()) return
        app.store.notified = (app.store.notified + fresh.map { "ann:${it.id}" }).toList().takeLast(200).toSet()
        if (!allowed(app)) return
        fresh.take(3).forEach { a -> note(app, 3000 + a.id, (if (a.kind == "class") I18n.t("New class") else I18n.t("New announcement")) + " · " + a.course, a.title) { it.putExtra("classes", true) } }
    }
    /** a teacher's new questions from students, each mentioned once */
    private suspend fun teacher(app: ZigoraApp): Result {
        runCatching { ClassAlarms.sync(app, app.api.get("/announcements?limit=30", AnnList.serializer()).upcoming) }  // their own classes too
        val items = try { app.api.get("/questions?status=waiting&limit=20", QuestionPage.serializer()).items } catch (e: Exception) { return Result.success() }
        val fresh = items.filter { "q:${it.id}:${it.updated}" !in app.store.notified }
        if (fresh.isEmpty()) return Result.success()
        app.store.notified = (app.store.notified + fresh.map { "q:${it.id}:${it.updated}" }).toList().takeLast(200).toSet()
        if (allowed(app)) fresh.take(5).forEach { q -> note(app, 2000 + q.id, I18n.t("A question from {name}", mapOf("name" to q.student.orEmpty())), q.topic + " · " + q.last) { it.putExtra("question", q.id) } }
        return Result.success()
    }

    companion object {
        const val CHANNEL = "answers"
        const val OPEN = "app.zigora.QUESTION"
        private const val WORK = "teacher-answers"
        fun schedule(ctx: Context, on: Boolean) {
            val wm = runCatching { WorkManager.getInstance(ctx) }.getOrNull() ?: return  // not started (screen tests): nothing to schedule
            if (!on) { wm.cancelUniqueWork(WORK); return }
            val req = PeriodicWorkRequestBuilder<AnswerWatch>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
            wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
