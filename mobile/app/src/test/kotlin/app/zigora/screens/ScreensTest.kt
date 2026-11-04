package app.zigora.screens

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.hasSetTextAction
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.zigora.ZigoraApp
import app.zigora.data.Api
import app.zigora.data.LoginOut
import app.zigora.data.Sealer
import app.zigora.data.Store
import app.zigora.data.Me
import app.zigora.data.json
import app.zigora.ui.ZigoraRoot
import com.github.takahirom.roborazzi.captureRoboImage
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** A student's walk through the app against a real Zigora server (see build.gradle.kts), with a screenshot of each screen. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w411dp-h891dp-xxhdpi")
class ScreensTest {
    @get:Rule val rule = createComposeRule()
    private val out = System.getProperty("screens.out")!!
    private val app get() = ApplicationProvider.getApplicationContext<ZigoraApp>()

    @org.junit.Before fun plainStore() { // Robolectric has no Android Keystore
        app.store = Store(app, object : Sealer { override fun seal(s: String) = s; override fun open(s: String) = s })
        app.api = Api(app.store) { app.signedOut.value++ }
    }
    private fun signIn(wallpaper: Boolean = false, email: String = "stu@mail.com") = runBlocking {
        app.store.server = System.getProperty("screens.server")!!; app.store.wallpaper = wallpaper
        val r = app.api.send("POST", "/login", buildJsonObject { put("email", email); put("password", "pw123456") }, LoginOut.serializer())
        app.store.token = r.token; app.store.userJson = json.encodeToString(Me.serializer(), r.user)
    }
    private fun see(text: String, ms: Long = 20_000) = rule.waitUntilAtLeastOneExists(hasText(text, substring = true), ms)
    private fun shot(name: String) { rule.waitForIdle(); rule.onRoot().captureRoboImage("$out/$name.png") }

    @Test fun signInScreen() {
        app.store.server = System.getProperty("screens.server")!!; app.store.signOut()
        rule.setContent { ZigoraRoot(null) {} }
        see("Calm, curious learning"); shot("01-sign-in")
    }

    private fun openChemistry() {  // the course row: the last "Engineering Chemistry" on Home (cards above may name it too), scrolled into view
        rule.waitUntilAtLeastOneExists(hasText("Engineering Chemistry"), 20_000)
        val row = rule.onAllNodesWithText("Engineering Chemistry").onLast(); runCatching { row.performScrollTo() }; row.performClick()
    }

    @Test fun aStudentsWalk() {
        signIn()
        rule.setContent { ZigoraRoot(null) {} }
        rule.waitUntilAtLeastOneExists(hasText("Engineering Chemistry"), 20_000); shot("02-home")
        openChemistry()
        see("Hardness of Water"); shot("03-course")
        rule.onNodeWithText("Hardness of Water").performClick()
        see("The gist"); see("calcium and magnesium"); shot("04-topic")
        rule.onNodeWithText("Why?").performClick()
        see("calcium bicarbonate breaks down"); shot("05-step")
        rule.onNodeWithText("Notes").performScrollTo(); shot("06-notes")  // the notes themselves are drawn by the web's renderer in a WebView, which Robolectric leaves blank
        repeat(3) { rule.onRoot().performTouchInput { swipeDown() } }  // the top bar hides on scrolling; bring its Back into view
        rule.onNodeWithContentDescription("Back").performClick()
        rule.waitUntilAtLeastOneExists(hasText("Water Technology"), 20_000); rule.onNodeWithContentDescription("Back").performClick()
        rule.waitUntil(20_000) { rule.onAllNodesWithContentDescription("Search").fetchSemanticsNodes().isNotEmpty() }  // back on Home
        rule.onAllNodesWithContentDescription("Search").onFirst().performClick()
        rule.onNode(hasSetTextAction()).performTextInput("hardness"); rule.onNode(hasSetTextAction()).performImeAction()
        see("In your topics"); shot("07-search")
        rule.onNodeWithText("Me").performClick()
        see("Rewards"); shot("08-me")
    }

    @Test fun materialYou() {
        signIn(wallpaper = true)
        rule.setContent { ZigoraRoot(null) {} }
        see("Engineering Chemistry"); shot("09-home-wallpaper-colours")
    }

    @Config(qualifiers = "ar-w411dp-h891dp-xxhdpi")
    @Test fun inArabic() {
        signIn()
        rule.setContent { ZigoraRoot(null) {} }
        see("Engineering Chemistry"); shot("10-home-arabic")
    }

    @Config(qualifiers = "ta-w411dp-h891dp-night-xxhdpi")
    @Test fun inTamilAtNight() {
        signIn()
        rule.setContent { ZigoraRoot(null) {} }
        openChemistry()
        see("Hardness of Water"); rule.onAllNodesWithText("Hardness of Water").onFirst().performClick(); see("calcium and magnesium"); shot("11-topic-tamil-dark")
    }

    @Test fun aLiteStudentsPlan() {
        signIn(email = "ravi@gmail.com")
        rule.setContent { ZigoraRoot(null) {} }
        see("Engineering Chemistry"); rule.onNodeWithText("Me").performClick()
        see("Searches today"); rule.onNodeWithText("Use my own AI key").performScrollTo(); shot("12-lite-plan")
    }

    @Test fun savedProgressAndRoutine() {
        signIn()
        rule.setContent { ZigoraRoot(null) {} }
        see("Engineering Chemistry"); rule.onNodeWithText("Saved").performClick()
        see("Bookmarks"); shot("13-saved")
        rule.onNodeWithText("Highlights").performClick(); see("All colours"); shot("14-highlights")
        rule.onNode(hasText("Progress") and hasClickAction()).performClick(); see("Study routine"); see("Topics learned"); shot("15-progress")  // once it has loaded
        rule.onNodeWithText("Set or change your study days").performClick(); see("Minutes a session"); shot("16-routine")
        rule.onNodeWithText("Save routine").performScrollTo().performClick()
        see("Study routine"); rule.onNode(hasText("Home") and hasClickAction()).performClick()
        see("Today's session"); shot("17-home-session")
    }

    @Test fun aQuizAndItsReview() {
        signIn()
        rule.setContent { ZigoraRoot(null) {} }
        openChemistry()
        see("Water Technology quiz"); rule.onNodeWithText("Water Technology quiz").performScrollTo().performClick()
        see("Which salts cause temporary hardness?"); rule.onNodeWithText("Bicarbonates").performClick()
        rule.onNodeWithText("Calcium carbonate").performScrollTo().performClick(); shot("18-quiz")
        rule.onNodeWithText("Submit answers").performScrollTo().performClick()
        see("Confirm submission"); rule.onNodeWithText("Confirm submission").performClick()  // the test asks before it is submitted
        see("2 / 2 · 100%"); shot("19-quiz-result")
        rule.onNodeWithText("Review answers").performClick(); see("Your answer"); shot("20-attempt")
    }

    @Test fun ownCourse() {
        signIn()
        rule.setContent { ZigoraRoot(null) {} }
        see("Your own courses"); rule.onNode(hasText("Courses") and hasClickAction()).performClick()
        rule.onNodeWithText("Build a course").performScrollTo().performClick()
        see("Thermodynamics notes"); shot("21-build")
        rule.onAllNodesWithText("Thermodynamics notes").onLast().performClick(); see("The zeroth law"); shot("22-own-course")
        rule.onNodeWithText("The zeroth law").performClick(); see("Check yourself"); shot("23-own-topic")
    }

    @Test fun teachersOpenTheTeachersSide() {
        signIn(email = "teacher@mail.com")
        rule.setContent { ZigoraRoot(null) {} }
        see("Questions"); see("Classes"); see("Courses"); see("Struggles"); shot("24-staff")  // faculty open the teacher's side of the app
    }
}
