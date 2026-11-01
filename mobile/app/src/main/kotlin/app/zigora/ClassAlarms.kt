package app.zigora

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.core.net.toUri
import app.zigora.data.Ann
import app.zigora.data.I18n

/** A note on the phone 10 minutes before each class, set on the phone itself (no push service): whenever the app sees the classes coming up
 *  (opening Classes or Home, or its background check about every 15 minutes), it sets an alarm for each one in the next week and takes back
 *  the alarms of classes that were cancelled or moved. Android may deliver it a little late when the phone is asleep. */
object ClassAlarms {
    private const val BEFORE = 10 * 60_000L
    private const val PREFS = "class-alarms"

    fun sync(ctx: Context, upcoming: List<Ann>) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis(); val want = mutableMapOf<String, Long>()
        for (a in upcoming) {
            if (a.kind != "class" || a.status == "cancelled" || a.starts_at == null) continue
            val start = runCatching { java.time.Instant.parse(a.starts_at).toEpochMilli() }.getOrNull() ?: continue
            val at = start - BEFORE
            if (at <= now || at - now > 7 * 86_400_000L) continue
            want[a.id.toString()] = at
            if (prefs.getLong(a.id.toString(), 0L) == at) continue  // already set for this time
            runCatching { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent(ctx, a)) }
        }
        for ((id, _) in prefs.all) if (id !in want) {  // cancelled, moved or over: take its alarm back
            runCatching { am.cancel(PendingIntent.getBroadcast(ctx, 5000 + (id.toIntOrNull() ?: 0), Intent(ctx, ClassReminder::class.java), PendingIntent.FLAG_IMMUTABLE)) }
        }
        prefs.edit { clear(); want.forEach { (k, v) -> putLong(k, v) } }
    }

    fun clear(ctx: Context) = sync(ctx, emptyList())

    private fun intent(ctx: Context, a: Ann) = PendingIntent.getBroadcast(ctx, 5000 + a.id, Intent(ctx, ClassReminder::class.java)
        .putExtra("id", a.id).putExtra("title", a.title).putExtra("course", a.course).putExtra("link", a.link), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
}

/** shows the reminder: tapping it opens Classes in the app (where Join is counted); "Join" opens the video link straight away */
class ClassReminder : BroadcastReceiver() {
    override fun onReceive(ctx: Context, i: Intent) {
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val id = i.getIntExtra("id", 0)
        val open = PendingIntent.getActivity(ctx, 6000 + id, Intent(ctx, MainActivity::class.java).setAction(AnswerWatch.OPEN).putExtra("classes", true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val b = NotificationCompat.Builder(ctx, AnswerWatch.CHANNEL).setSmallIcon(R.drawable.ic_launcher_monochrome)
            .setContentTitle(I18n.t("Class in 10 minutes") + " · " + i.getStringExtra("course").orEmpty()).setContentText(i.getStringExtra("title").orEmpty())
            .setContentIntent(open).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH)
        i.getStringExtra("link")?.let { link ->
            b.addAction(0, I18n.t("Join"), PendingIntent.getActivity(ctx, 7000 + id, Intent(Intent.ACTION_VIEW, link.toUri()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE))
        }
        NotificationManagerCompat.from(ctx).notify(4000 + id, b.build())
    }
}
