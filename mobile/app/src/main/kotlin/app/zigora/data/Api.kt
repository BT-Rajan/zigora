package app.zigora.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/** What the server said went wrong, in its own words (they are written for people). */
class ApiError(message: String, val code: Int) : Exception(message)

val json = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true }

/** The same API the web app uses. Every call carries the sign-in; a 401 signs the person out.
 *  What a student has read (a topic, its AI steps, translation, highlights, diagram, class questions, the course list, their questions) is kept
 *  in [keep] and shown from there when the phone is offline, so nothing is asked of the server, or the AI, again. Signing out forgets it. */
class Api(private val store: Store, private val keep: java.io.File? = null, private val onSignedOut: () -> Unit) {
    constructor(store: Store, onSignedOut: () -> Unit) : this(store, null, onSignedOut)
    /** true while screens show kept copies because the server can't be reached */
    val offline = androidx.compose.runtime.mutableStateOf(false)
    private fun keptFile(name: String) = keep?.let { java.io.File(it, java.security.MessageDigest.getInstance("SHA-1").digest(name.toByteArray()).joinToString("") { b -> "%02x".format(b) }) }
    fun keepText(name: String, text: String) { runCatching { keptFile(name)?.let { it.parentFile?.mkdirs(); it.writeText(text) } } }
    fun keptText(name: String): String? = runCatching { keptFile(name)?.takeIf { it.exists() }?.readText() }.getOrNull()
    fun forget() { runCatching { keep?.deleteRecursively() }; offline.value = false }
    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS).readTimeout(150, TimeUnit.SECONDS) // AI answers can take a while
        .build()

    val base get() = store.server.trimEnd('/')

    suspend fun <T> get(path: String, de: kotlinx.serialization.DeserializationStrategy<T>): T = json.decodeFromJsonElement(de, call("GET", path, null))
    suspend fun <T> send(method: String, path: String, body: JsonElement?, de: kotlinx.serialization.DeserializationStrategy<T>): T =
        json.decodeFromJsonElement(de, call(method, path, body))
    suspend fun raw(method: String, path: String, body: JsonElement? = null): JsonElement = call(method, path, body)

    /** a file sent as it is (study material), like the web's upload */
    suspend fun upload(path: String, bytes: ByteArray): JsonElement = call("POST", path, null, bytes)

    private suspend fun call(method: String, path: String, body: JsonElement?, bytes: ByteArray? = null): JsonElement = withContext(Dispatchers.IO) {
        if (base.isEmpty()) throw ApiError(I18n.str(app.zigora.R.string.need_address), 0)
        val rb = when {
            bytes != null -> bytes.toRequestBody("application/octet-stream".toMediaType())
            body != null -> body.toString().toRequestBody(JSON)
            method == "GET" || method == "DELETE" -> null
            else -> "{}".toRequestBody(JSON)
        }
        val req = Request.Builder().url("$base/api$path").method(method, rb).header("Accept", "application/json")
            .apply { store.token?.let { header("Authorization", "Bearer $it") } }.build()
        val readable = method == "GET" && KEEP.matches(path)
        val res = try { http.newCall(req).execute() } catch (e: IOException) {
            if (readable) keptText(path)?.let { k -> runCatching { json.parseToJsonElement(k) }.getOrNull() }?.let { offline.value = true; return@withContext it }
            throw ApiError(I18n.str(app.zigora.R.string.err_offline), 0)
        }
        res.use {
            val text = it.body.string()
            val parsed = runCatching { json.parseToJsonElement(text) }.getOrNull()
            if (!it.isSuccessful) {
                if (it.code == 401 && store.token != null && path != "/login") { store.signOut(); forget(); onSignedOut() }
                throw ApiError(I18n.srv(detail(parsed)).ifEmpty { I18n.t("Something went wrong") + " (${it.code})" }, it.code)
            }
            val out = parsed ?: throw ApiError(I18n.str(app.zigora.R.string.err_unexpected), it.code)
            if (readable) { keepText(path, text); offline.value = false }
            out
        }
    }

    private fun detail(e: JsonElement?): String? = runCatching {
        val d = (e as JsonObject)["detail"]!!
        d.jsonPrimitive.contentOrNull
    }.getOrNull() ?: runCatching { // FastAPI's validation errors are a list
        ((e as JsonObject)["detail"] as kotlinx.serialization.json.JsonArray)[0].jsonObject["msg"]!!.jsonPrimitive.content
    }.getOrNull()

    private companion object {
        val JSON = "application/json".toMediaType()
        val KEEP = Regex("""/(tree|ai/status|me/questions|questions/\d+|topics/\d+(/(ai/\w+|translation|highlights|diagram|class-questions))?)""")
    }
}
