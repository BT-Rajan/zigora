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
import java.util.concurrent.TimeUnit

/** A note on the phone when a teacher answers one of the student's questions: Android looks every 15 minutes or so (its shortest interval
 *  for background work), and each answer is mentioned once. Tapping it opens the question. Only for students, only with notifications allowed. */
class AnswerWatch(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as ZigoraApp
        if (app.store.token == null) return Result.success()
        val items = try { app.api.get("/me/questions", QuestionList.serializer()).items } catch (e: Exception) { return Result.success() }  // try again next time
        val fresh = items.filter { it.unread && "answer:${it.id}:${it.updated}" !in app.store.notified }
        if (fresh.isEmpty()) return Result.success()
        app.store.notified = (app.store.notified + fresh.map { "answer:${it.id}:${it.updated}" }).toList().takeLast(200).toSet()
        if (ContextCompat.checkSelfPermission(app, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return Result.success()
        fresh.take(5).forEach { q ->
            val open = PendingIntent.getActivity(app, q.id, Intent(app, MainActivity::class.java).setAction(OPEN).putExtra("question", q.id)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val n = NotificationCompat.Builder(app, CHANNEL).setSmallIcon(R.drawable.ic_launcher_monochrome)
                .setContentTitle(I18n.t("Your teacher answered your question")).setContentText(q.topic + if (q.last.isNotEmpty()) " · " + q.last else "")
                .setStyle(NotificationCompat.BigTextStyle().bigText(q.last)).setContentIntent(open).setAutoCancel(true).build()
            NotificationManagerCompat.from(app).notify(1000 + q.id, n)
        }
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
