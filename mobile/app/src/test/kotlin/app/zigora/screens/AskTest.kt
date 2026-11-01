package app.zigora.screens

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.zigora.ZigoraApp
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

/** Ask the teacher and buying Pro, against .promo/server.py: a student asks from a topic and finds Priya's answer under Saved > Questions;
 *  a student on Lite sees the Pro offers on their profile (Razorpay's own page opens in the browser, which a test can't follow). */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class AskTest {
    @get:org.junit.Rule val rule = createComposeRule()
    private val app get() = ApplicationProvider.getApplicationContext<ZigoraApp>()
    private val out = System.getProperty("screens.out")!! + "/ask"

    private fun shot(name: String) { rule.waitForIdle(); rule.onRoot().captureRoboImage("$out/$name.png") }
    private fun see(text: String) = rule.waitUntilAtLeastOneExists(hasText(text, substring = true), 20_000)
    private fun tap(text: String) { see(text); rule.onAllNodesWithText(text, substring = true).onFirst().performScrollTo().performClick() }

    private fun signIn(email: String) = runBlocking {
        app.store = Store(app, object : Sealer { override fun seal(s: String) = s; override fun open(s: String) = s })  // Robolectric has no Android Keystore
        app.api = Api(app.store) { app.signedOut.value++ }
        app.store.server = System.getProperty("screens.server")!!; app.store.wallpaper = false
        val r = app.api.send("POST", "/login", buildJsonObject { put("email", email); put("password", "pw123456") }, LoginOut.serializer())
        app.store.token = r.token; app.store.userJson = json.encodeToString(Me.serializer(), r.user)
    }

    @Test fun aStudentAsksTheTeacherAndReadsTheAnswer() {
        signIn("stu@mail.com"); rule.setContent { ZigoraRoot(null) {} }
        see("Engineering Chemistry"); rule.onNode(hasText("Courses") and hasClickAction()).performClick()
        see("Engineering Chemistry"); rule.onAllNodesWithText("Engineering Chemistry").onLast().performClick()
        tap("Hardness of Water"); see("The gist")
        tap("Ask my teacher"); see("Your teacher sees your name")
        rule.onNode(hasSetTextAction()).performTextInput("How do we measure hardness in ppm?"); shot("1-ask")
        rule.onAllNodesWithText("Send to my teacher").onLast().performScrollTo().performClick(); rule.waitUntil(20_000) { rule.onAllNodesWithText("Your teacher sees your name", substring = true).fetchSemanticsNodes().isEmpty() }
        rule.onNodeWithContentDescription("Back").performClick()
        rule.onNodeWithContentDescription("Back").performClick()
        see("Saved"); rule.onNode(hasText("Saved") and hasClickAction()).performClick(); tap("Questions")
        see("How do we measure hardness"); see("Waiting for your teacher"); shot("2-my-questions")
        tap("Heat splits the bicarbonate"); see("Why does only the bicarbonate"); see("Priya Raman"); shot("3-thread")
    }

    @Test fun aLiteStudentSeesTheProOffers() {
        signIn("ravi@gmail.com"); rule.setContent { ZigoraRoot(null) {} }
        see("Engineering Chemistry"); rule.onNode(hasText("Me") and hasClickAction()).performClick()
        see("Pro for 1 month"); rule.onAllNodesWithText("Pro for 1 month", substring = true).onFirst().performScrollTo(); see("Razorpay"); shot("4-pro-offers")
    }
}
