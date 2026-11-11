package app.zigora.screens

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.zigora.ZigoraApp
import app.zigora.data.Api
import app.zigora.data.LoginOut
import app.zigora.data.Me
import app.zigora.data.Sealer
import app.zigora.data.Store
import app.zigora.data.json
import app.zigora.ui.AI_OFF
import app.zigora.ui.ZigoraRoot
import com.github.takahirom.roborazzi.captureRoboImage
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** The school and college onboarding on a phone: sign-up steps, a parent's and a teacher's screens, a child with no AI key, and a teacher's
 *  invitation. Against the server mobile/screens_seed.py starts; a screenshot of each screen goes to build/screens. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w411dp-h891dp-xxhdpi")
class OnboardingTest {
    @get:Rule val rule = createComposeRule()
    private val out = System.getProperty("screens.out")!!
    private val server = System.getProperty("screens.server")!!
    private val app get() = ApplicationProvider.getApplicationContext<ZigoraApp>()

    @org.junit.Before fun plainStore() { // Robolectric has no Android Keystore
        app.store = Store(app, object : Sealer { override fun seal(s: String) = s; override fun open(s: String) = s })
        app.api = Api(app.store) { app.signedOut.value++ }
    }
    private fun signIn(who: String) = runBlocking {  // an email, or a child's username
        app.store.server = server
        val r = app.api.send("POST", "/login", buildJsonObject { put("email", who); put("password", "pw123456") }, LoginOut.serializer())
        app.store.token = r.token; app.store.userJson = json.encodeToString(Me.serializer(), r.user)
    }
    private fun see(text: String, ms: Long = 20_000) = rule.waitUntilAtLeastOneExists(hasText(text, substring = true), ms)
    private fun tap(text: String) { val n = rule.onAllNodesWithText(text, substring = true).onFirst(); runCatching { n.performScrollTo() }; n.performClick() }  // Home has cards above the buttons now: bring it on screen first, like the other screen tests
    private fun none(text: String) = rule.onAllNodesWithText(text, substring = true).fetchSemanticsNodes().isEmpty()
    private fun shot(name: String) { rule.waitForIdle(); rule.onRoot().captureRoboImage("$out/$name.png") }

    @Test fun signUpAsksSchoolOrCollegeThenWho() {
        app.store.server = server; app.store.signOut()
        rule.setContent { ZigoraRoot(null) {} }
        see("Create an account"); tap("Create an account")  // the Create an account tab: Google or email
        see("Sign up with email"); shot("onboarding-00-create-an-account"); tap("Sign up with email")
        see("Who is studying?"); shot("onboarding-01-school-or-college")
        tap("A school student"); see("Who is signing up?"); shot("onboarding-02-who")
        tap("A parent"); see("Child 1"); see("Your children"); shot("onboarding-03-parent-form")
        rule.onAllNodesWithText("Add another child").onFirst().performScrollTo(); shot("onboarding-04-parent-form-children")
    }

    @Test fun aCodeEmailThatCannotBeSentSaysSoAndOffersAWayOn() {  // the screens server's mail host doesn't exist, so every code email fails
        app.store.server = server; app.store.signOut()
        rule.setContent { ZigoraRoot(null) {} }
        see("Create an account"); tap("Create an account"); see("Sign up with email"); tap("Sign up with email")
        see("Who is studying?"); tap("A school student"); see("Who is signing up?"); tap("I'm the student")
        fun type(label: String, v: String) { val n = rule.onAllNodes(hasSetTextAction() and hasText(label, substring = true)).onFirst(); runCatching { n.performScrollTo() }; n.performTextInput(v) }
        type("Full name", "Nila"); type("School", "Govt. High School"); type("Email", "nila@home.in"); type("Phone", "+91 98765 43210"); type("Password", "longenough1")
        tap("Send me a code")
        see("We couldn't send your verification code", 60_000); assertTrue("no code screen when no code went out", none("Verify and create my account")); shot("onboarding-09-code-not-sent")
        tap("Try sending the code again"); see("It didn't go through this time either", 60_000)
        tap("Back to sign in"); see("Email or username")
    }

    @Test fun aStudentNotPlacedYetIsShownTwoWaysToStart() {
        signIn("mum@x.com")  // a parent adds a child with no grade: they sign in unplaced
        runBlocking { app.api.raw("POST", "/guardian/students", kotlinx.serialization.json.buildJsonObject { put("students", kotlinx.serialization.json.JsonArray(listOf(
            buildJsonObject { put("name", "Nila"); put("username", "nila.r"); put("password", "pw123456") }))) }) }
        signIn("nila.r")
        rule.setContent { ZigoraRoot(null) {} }
        see("Your account is ready"); see("program and grade"); see("You don't have to wait to start learning.")
        see("Build a course from your own notes"); see("Join a course offered by a teacher"); shot("onboarding-10-not-placed-yet")
        tap("Join a course offered by a teacher"); see("Join a course")
    }

    @Test fun aStudentInATermWithNoCoursesIsToldAndShownTwoWaysToStart() {
        signIn("mum@x.com")  // a parent adds Tara; an admin places her in a new program whose Year 1 has no courses
        runBlocking { app.api.raw("POST", "/guardian/students", buildJsonObject { put("students", kotlinx.serialization.json.JsonArray(listOf(
            buildJsonObject { put("name", "Tara"); put("username", "tara.k"); put("password", "pw123456") }))) }) }
        signIn("admin@x.com")
        runBlocking {
            val pid = app.api.raw("POST", "/programs", buildJsonObject { put("name", "B.Sc Physics"); put("pattern", "year"); put("terms", 1) }).jsonObject["id"]!!.jsonPrimitive.int
            val users = app.api.raw("GET", "/admin/users?q=tara").jsonObject["items"]!!.jsonArray
            val id = users.first { it.jsonObject["name"]!!.jsonPrimitive.content == "Tara" }.jsonObject["id"]!!.jsonPrimitive.int
            app.api.raw("PATCH", "/admin/users/$id", buildJsonObject { put("program_id", pid); put("semester", 1) })
        }
        signIn("tara.k")
        rule.setContent { ZigoraRoot(null) {} }
        see("Courses"); rule.onAllNodesWithText("Courses").onFirst().performClick()
        see("No courses have been added to Year 1 yet"); see("Join a course offered by a teacher"); see("Build a course from your own notes"); shot("onboarding-11-term-with-no-courses")
    }

    @Test fun aNewStudentCompletesTheirProfileAndTheFreeNoteClosesByItself() {
        signIn("neha@x.com"); rule.setContent { ZigoraRoot(null) {} }
        see("Complete your profile"); see("Your course of study"); shot("onboarding-12-profile-course")
        tap("Continue"); see("Choose your plan"); see("My own AI key"); shot("onboarding-13-profile-plan")
        tap("Free"); see("AI costs us money"); see("Continue free"); shot("onboarding-14-free-note")
        see("Your account is ready", 30_000)  // nobody tapped: the note closed by itself and she carries on free, on Home
        assertTrue("asked once", none("Complete your profile"))
    }

    @Test fun theLogoOpensTheMenuDrawer() {
        signIn("asha@x.com"); rule.setContent { ZigoraRoot(null) {} }
        see("Asha"); rule.onAllNodesWithContentDescription("Menu").onFirst().performClick()
        see("Join a course"); see("My routine"); see("Classes and announcements"); shot("onboarding-15-drawer")
        tap("My routine"); see("Minutes a session")
    }

    @Test fun aParentSeesTheirChildAndTheAiKey() {
        signIn("mum@x.com")
        rule.setContent { ZigoraRoot(null) {} }
        see("Your children"); see("Kavin"); see("Each child signs in with their own username"); shot("onboarding-05-parent-home")
        assertTrue("the parent's AI panel says off", !none("Add an AI key"))
        tap("Kavin"); see("topics learned"); see("Forgot their password?"); shot("onboarding-06-child-progress")
    }

    @Test fun aTeacherCanAddAndInvite() {
        signIn("rani@school.in")
        rule.setContent { ZigoraRoot(null) {} }
        see("Your students"); see("Divya"); see("Invite a student"); shot("onboarding-07-teacher-home")  // Divya shows as invited until another test accepts
        tap("Add students"); see("Student 1"); shot("onboarding-08-teacher-add")
    }

    @Test fun aChildWithoutAKeyGetsNoAi() {
        signIn("kavin")
        rule.setContent { ZigoraRoot(null) {} }
        see("Science"); shot("onboarding-09-child-home")
        rule.onAllNodesWithText("Science").onFirst().performClick()  // the course card (an exact match, not a topic row that names the course)
        see("Soft water"); tap("Soft water")
        see("Notes"); assertTrue("without AI the steps are only the notes", none("The gist"))  // one step per screen: the notes, then I've learned this
        see("Full page"); tap("Full page"); see(AI_OFF); shot("onboarding-10-child-topic-no-ai")
        assertTrue("no Explain tab without a key", none("Sample answer"))
    }

    @Test fun aStudentAcceptsAnInvitation() {
        signIn("divya@x.com")
        rule.setContent { ZigoraRoot(null) {} }
        see("Ms Rani wants to follow your progress"); shot("onboarding-11-invitation")
        tap("Accept")
        rule.waitUntil(20_000) { none("wants to follow your progress") }; shot("onboarding-12-invitation-accepted")
    }
}
