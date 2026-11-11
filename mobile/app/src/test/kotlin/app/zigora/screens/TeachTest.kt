package app.zigora.screens

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithText
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
import app.zigora.ui.coursesOf
import app.zigora.data.ProgramNode
import kotlinx.serialization.builtins.ListSerializer
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
        tap("Why does only the bicarbonate"); see("Heat splits the bicarbonate")  // S42: rows show the question, the thread shows the answer
        see("Stop sharing with the class"); see("Your answer"); shot("2-thread")
        tab("Classes"); see("Revision: water technology"); see("Join the class"); shot("3-classes")
        tap("Schedule a class or post an announcement"); see("Video link")
        rule.onAllNodes(hasSetTextAction())[0].performTextInput("Doubt-clearing session")
        rule.onAllNodes(hasSetTextAction())[1].performTextReplacement(java.time.LocalDate.now().plusDays(1).toString())  // tomorrow: today's 18:00 may have passed
        rule.onAllNodes(hasSetTextAction())[4].performTextInput("https://meet.google.com/xyz-abcd-efg")
        rule.onAllNodesWithText("Schedule the class").onLast().performScrollTo().performClick()
        rule.waitUntil(20_000) { rule.onAllNodesWithText("Video link").fetchSemanticsNodes().isEmpty() }  // the form closed: it was saved
        see("Doubt-clearing session"); see("Coming up"); shot("4-scheduled")
        tab("Struggles"); see("Where students struggle"); see("Hardness of Water"); see("questions to you"); shot("5-struggles")
        // a topic as the teacher sees it, opened from its row in the list (the row is the one that opens; its name is also in the course links' area)
        rule.onAllNodes(hasText("Hardness of Water") and hasClickAction()).onFirst().performClick(); see("Hard water carries dissolved calcium"); shot("27-teacher-topic")
    }

    /** the doubt centre's folded filters and its report, and a class's changes behind its menu */
    @Test fun aTeacherFiltersReportsAndChangesAClass() {
        signIn("teacher@mail.com"); rule.setContent { ZigoraRoot(null) {} }
        see("Student questions"); see("Hardness of Water")
        rule.onAllNodesWithContentDescription("Filters").onFirst().performClick(); see("Sort by"); see("Oldest unanswered first"); shot("10-inbox-filters")
        tab("Report"); see("Topics with the most doubts"); shot("11-doubt-report")
        tab("Classes"); see("Join the class")
        rule.onAllNodesWithContentDescription("More options").onFirst().performClick(); see("Change the time"); shot("12-class-menu")
    }

    /** the teacher's own offered course: the list, its students and what can be done with it */
    @Test fun aTeacherRunsAnOfferedCourse() {
        signIn("teacher@mail.com"); rule.setContent { ZigoraRoot(null) {} }
        tab("Courses"); see("Offered courses"); see("Python for engineers"); shot("13-courses")
        tap("Python for engineers"); see("Invite students"); shot("14-course-students")
        tab("Course"); see("Repeat this course"); rule.onNodeWithText("Repeat this course").performScrollTo(); shot("15-course-manage")
        tab("Message"); see("Attach material"); shot("24-course-message")  // a note to every student on the course, with a file if wanted
        tab("Course"); tap("Repeat this course"); see("Make the new run"); rule.onNodeWithText("Make the new run").performScrollTo(); shot("26-repeat-form")
    }

    /** a course's class insight: the topics, one topic's evidence, one student's record on it */
    @Test fun aTeacherReadsClassInsight() {
        signIn("teacher@mail.com"); rule.setContent { ZigoraRoot(null) {} }
        tab("Struggles"); tap("Class insight"); see("students were active"); shot("16-class-insight")
        tap("Hardness of Water"); see("Ask the AI what the evidence suggests"); shot("17-insight-topic")
        // her name is also under the doubts she wrote; the student row is the one that opens
        see("Meena Kumar"); rule.onAllNodes(hasText("Meena Kumar") and hasClickAction()).onFirst().performScrollTo().performClick()
        see("Sittings"); shot("18-insight-student")
    }

    /** a support plan made for Meena (through the API, as on the web), then the teacher follows it on the phone */
    @Test fun aTeacherFollowsASupportPlan() {
        signIn("stu@mail.com")
        val (sid, cid, tid) = runBlocking {  // Meena's id, and the course and topic, as she sees them
            val me = json.decodeFromString(Me.serializer(), app.store.userJson!!)
            val c = coursesOf(app.api.get("/tree", ListSerializer(ProgramNode.serializer()))).first { it.name == "Engineering Chemistry" }
            Triple(me.id, c.id, c.units.flatMap { it.topics }.first { it.title == "Hardness of Water" }.id)
        }
        signIn("teacher@mail.com")
        runBlocking {
            app.api.raw("POST", "/interventions", buildJsonObject {
                put("course_id", cid); put("title", "Hardness, once more"); put("description", "Two short steps before the unit test."); put("activate", true)
                put("topic_ids", kotlinx.serialization.json.buildJsonArray { add(kotlinx.serialization.json.JsonPrimitive(tid)) })
                put("student_ids", kotlinx.serialization.json.buildJsonArray { add(kotlinx.serialization.json.JsonPrimitive(sid)) })
                put("activities", kotlinx.serialization.json.buildJsonArray {
                    add(buildJsonObject { put("kind", "study"); put("topic_id", tid) }); add(buildJsonObject { put("kind", "revise"); put("topic_id", tid) })
                })
            })
        }
        rule.setContent { ZigoraRoot(null) {} }
        tab("Struggles"); tap("Support plans"); see("Hardness, once more"); shot("19-support-plans")
        tap("Hardness, once more"); see("Activities"); shot("20-support-plan")
        tap("Meena Kumar"); see("Before and after"); shot("21-support-student")
    }

    /** the teacher's Me tab, and offering a course */
    @Test fun aTeacherSeesMeAndOffersACourse() {
        signIn("teacher@mail.com"); rule.setContent { ZigoraRoot(null) {} }
        tab("Me"); see("Sign out"); shot("22-me")
        tab("Courses"); tap("Offer a course"); see("Who may join"); shot("23-offer-form")
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
        tap("Hardness of Water"); see("The gist"); tap("Full page"); tap("Sample answer"); see("Model answer from your teacher"); see("Total")
        rule.onAllNodesWithText("Model answer from your teacher", substring = true).onFirst().performScrollTo(); shot("7-model-answer")
    }
}
