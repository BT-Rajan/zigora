package app.zigora.screens

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.zigora.ZigoraApp
import app.zigora.ClassReminder
import app.zigora.data.AnnList
import app.zigora.data.Api
import app.zigora.data.LoginOut
import app.zigora.data.Me
import app.zigora.data.Sealer
import app.zigora.data.Store
import app.zigora.data.json
import app.zigora.ui.ZigoraRoot
import com.github.takahirom.roborazzi.captureRoboImage
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** The teacher's side of the app, against .promo/server.py (Priya teaches Engineering Chemistry): students' questions, classes and announcements,
 *  and where students struggle; and the student's side of it: the next class on Home and the teacher's marked model answer. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class TeachTest {
    @get:org.junit.Rule val rule = createComposeRule()
    private val app get() = ApplicationProvider.getApplicationContext<ZigoraApp>()
    private val out = System.getProperty("screens.out")!! + "/teach"

    private fun shot(name: String) { rule.waitForIdle(); rule.onRoot().captureRoboImage("$out/$name.png") }
    private fun see(text: String) = rule.waitUntilAtLeastOneExists(hasText(text, substring = true), 20_000)
    private fun tap(text: String) { see(text); rule.onAllNodesWithText(text, substring = true).onFirst().performScrollTo().performClick() }
    private fun tab(text: String) { rule.waitUntilAtLeastOneExists(hasText(text) and hasClickAction(), 20_000); rule.onAllNodes(hasText(text) and hasClickAction()).onFirst().performClick() }

    private fun signIn(email: String) = runBlocking {
        app.store = Store(app, object : Sealer { override fun seal(s: String) = s; override fun open(s: String) = s })  // Robolectric has no Android Keystore
        app.api = Api(app.store) { app.signedOut.value++ }
        app.store.server = System.getProperty("screens.server")!!; app.store.wallpaper = false
        val r = app.api.send("POST", "/login", buildJsonObject { put("email", email); put("password", "pw123456") }, LoginOut.serializer())
        app.store.token = r.token; app.store.userJson = json.encodeToString(Me.serializer(), r.user)
    }

    @Test fun aTeacherAnswersSharesAndSchedules() {
        signIn("teacher@mail.com"); rule.setContent { ZigoraRoot(null) {} }
        see("Student questions"); see("Hardness of Water"); shot("1-inbox")  // S42: the centre lists every doubt until a filter is picked
        tap("Heat splits the bicarbonate"); see("Why does only the bicarbonate"); see("Stop sharing with the class"); see("Your answer"); shot("2-thread")
        tab("Classes"); see("Revision: water technology"); see("Join the class"); shot("3-classes")
        tap("Schedule a class or post an announcement"); see("Video link")
        rule.onAllNodes(hasSetTextAction())[0].performTextInput("Doubt-clearing session")
        rule.onAllNodes(hasSetTextAction())[1].performTextReplacement(java.time.LocalDate.now().plusDays(1).toString())  // tomorrow: today's 18:00 may have passed
        rule.onAllNodes(hasSetTextAction())[4].performTextInput("https://meet.google.com/xyz-abcd-efg")
        rule.onAllNodesWithText("Schedule the class").onLast().performScrollTo().performClick()
        rule.waitUntil(20_000) { rule.onAllNodesWithText("Video link").fetchSemanticsNodes().isEmpty() }  // the form closed: it was saved
        see("Doubt-clearing session"); see("Coming up"); shot("4-scheduled")
        tab("Struggles"); see("Where students struggle"); see("Hardness of Water"); see("questions to you"); shot("5-struggles")
    }

    /** a weekly class from the app: every session is scheduled, and the list shows the next one with its place in the series */
    @Test fun aTeacherSchedulesAWeeklyClass() {
        signIn("teacher@mail.com"); rule.setContent { ZigoraRoot(null) {} }
        tab("Classes"); tap("Schedule a class or post an announcement"); see("Video link")
        rule.onAllNodes(hasSetTextAction())[0].performTextInput("Weekly tutorial")
        rule.onAllNodes(hasSetTextAction())[1].performTextReplacement(java.time.LocalDate.now().plusDays(1).toString())
        rule.onAllNodes(hasSetTextAction())[4].performTextInput("https://meet.google.com/wkl-abcd-efg")
        tap("Repeat every week"); see("How many weeks"); shot("8-weekly-form")
        rule.onAllNodesWithText("Schedule the class").onLast().performScrollTo().performClick()
        rule.waitUntil(20_000) { rule.onAllNodesWithText("Video link").fetchSemanticsNodes().isEmpty() }
        see("Weekly tutorial"); see("Weekly, session 1 of 8"); rule.onAllNodesWithText("Weekly tutorial", substring = true).onFirst().performScrollTo(); shot("9-weekly")
    }

    /** the phone sets a reminder 10 minutes before each class it sees coming up, and the reminder offers Join */
    @Test fun aStudentGetsAReminderTenMinutesBeforeAClass() {
        org.robolectric.Shadows.shadowOf(app).grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS)
        signIn("stu@mail.com"); rule.setContent { ZigoraRoot(null) {} }
        see("Join the class")
        val am = org.robolectric.Shadows.shadowOf(app.getSystemService(android.app.AlarmManager::class.java))
        val start = runBlocking { app.api.get("/announcements", AnnList.serializer()).upcoming.first { it.title == "Revision: water technology" }.starts_at!! }
        rule.waitUntil(20_000) { am.scheduledAlarms.any { it.triggerAtTime == java.time.Instant.parse(start).toEpochMilli() - 10 * 60_000L } }
        val alarm = am.scheduledAlarms.first { it.triggerAtTime == java.time.Instant.parse(start).toEpochMilli() - 10 * 60_000L }  // 10 minutes before this class
        ClassReminder().onReceive(app, org.robolectric.Shadows.shadowOf(alarm.operation).savedIntent)
        val n = org.robolectric.Shadows.shadowOf(app.getSystemService(android.app.NotificationManager::class.java)).allNotifications.last()
        org.junit.Assert.assertTrue(n.extras.getString("android.title")!!.startsWith("Class in 10 minutes"))
        org.junit.Assert.assertEquals("Join", n.actions.single().title.toString())
    }

    @Test fun aStudentSeesTheNextClassAndTheMarkedModelAnswer() {
        signIn("stu@mail.com"); rule.setContent { ZigoraRoot(null) {} }
        see("Join the class"); see("Classes and announcements"); rule.onAllNodesWithText("Join the class").onFirst().performScrollTo(); shot("6-home-class")  // the next class, whichever it is
        rule.onNode(hasText("Courses") and hasClickAction()).performClick()
        see("Engineering Chemistry"); rule.onAllNodesWithText("Engineering Chemistry").onLast().performClick()
        tap("Hardness of Water"); see("The gist"); tap("Sample answer"); see("Model answer from your teacher"); see("Total")
        rule.onAllNodesWithText("Model answer from your teacher", substring = true).onFirst().performScrollTo(); shot("7-model-answer")
    }
}
