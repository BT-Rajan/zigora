package app.zigora.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

// The shapes the server sends. Only what the app shows is read; anything new the server adds is ignored.

@Serializable data class Config(val name: String = "Zigora", val self_registration: Boolean = false, val email_signup: Boolean = true, val email_reset: Boolean = false, val version: String? = null,
                                val google_client_id: String? = null)  // Sign in with Google: the server's web client ID, which Google's sheet on Android asks a token for
@Serializable data class Me(val id: Int, val name: String, val role: String, val must_change: Boolean = false, val self_registered: Boolean = false, val placed: Boolean = true, val lang: String = "en",
                            val username: String? = null, val relation: String? = null, val level: String? = null, val ai_off: Boolean = false)  // relation: a guardian's "parent" or "teacher"; ai_off: a school student with no parent's or teacher's key
@Serializable data class Msg(val message: String = "", val ok: Boolean = true)
@Serializable data class CodeOut(val message: String = "", val sent: Boolean = true)  // a sign-up code: whether its email went out
@Serializable data class RegStatus(val open: Boolean = false, val domains: List<String> = emptyList())
@Serializable data class LoginOut(val token: String, val user: Me)

@Serializable data class QuizRef(val id: Int, val title: String, val published: Boolean = true, val questions: Int = 0, val best: Int? = null, val pass_percent: Int = 50)
@Serializable data class TopicRef(val id: Int, val title: String, val status: String = "not_started", val bookmarked: Boolean = false, val archived: Boolean = false,
                                  val learning_due_at: String? = null, val overdue: Boolean = false, val has_notes: Boolean = false)
@Serializable data class UnitNode(val id: Int, val name: String, val archived: Boolean = false, val topics: List<TopicRef> = emptyList(), val quizzes: List<QuizRef> = emptyList())
@Serializable data class CourseNode(val id: Int, val name: String, val archived: Boolean = false, val units: List<UnitNode> = emptyList(), val tests: List<QuizRef> = emptyList(),
                                    val upcoming: Boolean = false, val starts_on: String? = null, val paused: Boolean = false)  // upcoming: before its first day; paused: by its teacher (locked meanwhile)
@Serializable data class SemesterNode(val id: Int, val name: String, val current: Boolean = false, val courses: List<CourseNode> = emptyList())
@Serializable data class ProgramNode(val id: Int, val name: String, val semesters: List<SemesterNode> = emptyList())

@Serializable data class Focus(val kind: String, val title: String, val reason: String = "", val course: String = "", val unit: String = "", val topic_id: Int? = null, val quiz_id: Int? = null, val last_read: String? = null)
@Serializable data class Today(val streak: Int = 0, val percent: Int = 0, val topics_total: Int = 0, val topics_completed: Int = 0, val focus: List<Focus> = emptyList())
@Serializable data class RecallItem(val topic_id: Int, val title: String, val question: String, val answer: String)
@Serializable data class Recall(val item: RecallItem? = null)

@Serializable data class Nav(val prev: NavTopic? = null, val next: NavTopic? = null, val position: Int? = null, val total: Int = 0)
@Serializable data class NavTopic(val id: Int, val title: String)
@Serializable data class TopicFull(val id: Int, val ask: String? = null, val model_answer: ModelAnswer? = null, val title: String, val course: String = "", val course_id: Int = 0, val unit: String = "", val semester: String = "", val program: String = "",
                                   val content: String? = null, val content_format: String = "markdown", val question_pattern: String? = null, val guideline: String? = null,
                                   val my_notes: String? = null, val frame_url: String? = null, val status: String = "not_started", val learning_due_at: String? = null,
                                   val bookmarked: Boolean = false, val nav: Nav? = null,
                                   val diagram: String? = null)  // null: no diagram; "pro": the teacher wants one and it comes with Pro; "on": it opens
/** a topic's diagram: the sandboxed page to open full screen */
@Serializable data class DiagramOut(val frame_url: String, val cached: Boolean = false)
@Serializable data class Learning(val status: String = "not_started")
/** ask the teacher: a student's question about a topic, and its thread with the course's teacher */
@Serializable data class QuestionRow(val id: Int, val topic_id: Int = 0, val topic: String = "", val course: String = "", val status: String = "waiting", val updated: String? = null,
                                     val last: String = "", val unread: Boolean = false, val student: String? = null, val message: Boolean = false)
@Serializable data class QuestionPage(val total: Int = 0, val items: List<QuestionRow> = emptyList())
@Serializable data class QuestionList(val items: List<QuestionRow> = emptyList())
/** a course a teacher offers, as a student sees it in Join a course */
@Serializable data class Offer(val id: Int, val name: String = "", val about: String = "", val starts_on: String? = null, val ends_on: String? = null, val access: String = "enroll",
                               val state: String = "running", val teacher: String = "", val topics: Int = 0, val mine: String? = null, val enrolment: Int? = null, val told: String? = null, val expires_at: String? = null,
                               val applications: Boolean = false, val counts: Map<String, Int> = emptyMap())
@Serializable data class RosterRow(val id: Int, val name: String = "", val who: String = "", val status: String = "", val label: String = "", val expires_at: String? = null)
@Serializable data class Roster(val course: Offer, val items: List<RosterRow> = emptyList())
@Serializable data class InviteOut(val invited: Int = 0, val already: List<String> = emptyList(), val not_found: List<String> = emptyList())
@Serializable data class Sent(val sent: Int = 0)
@Serializable data class FileRef(val url: String = "", val name: String = "file")
@Serializable data class OfferList(val items: List<Offer> = emptyList(), val invited: List<Offer> = emptyList())
@Serializable data class QuestionMsg(val id: Int, val mine: Boolean = false, val teacher: Boolean = false, val who: String? = null, val text: String = "", val image: String? = null, val at: String? = null,
                                     val file: FileRef? = null)
@Serializable data class QuestionThread(val id: Int, val topic_id: Int = 0, val topic: String = "", val course: String = "", val status: String = "waiting", val excerpt: String? = null,
                                        val messages: List<QuestionMsg> = emptyList(), val shared: Boolean = false, val teacher: Boolean = false, val can_share: Boolean = false,
                                        val student: String? = null)
/** a teacher's marked model answer for a topic */
@Serializable data class MAPart(val text: String = "", val marks: Double = 0.0)
@Serializable data class ModelAnswer(val question: String = "", val parts: List<MAPart> = emptyList(), val total: Double = 0.0, val by: String = "")
/** announcements and classes */
@Serializable data class Ann(val id: Int, val kind: String = "note", val course_id: Int = 0, val course: String = "", val title: String = "", val body: String = "", val by: String = "",
                             val at: String? = null, val starts_at: String? = null, val minutes: Int? = null, val link: String? = null, val status: String? = null, val can_edit: Boolean = false,
                             val series: String? = null, val week: AnnWeek? = null, val joined: Boolean = false, val joins: List<AnnJoin>? = null, val class_size: Int = 0)
@Serializable data class AnnWeek(val n: Int = 0, val of: Int = 0, val more: Int = 0)
@Serializable data class AnnJoin(val name: String = "", val at: String? = null)
@Serializable data class CourseRef(val id: Int, val name: String)
@Serializable data class AnnList(val items: List<Ann> = emptyList(), val upcoming: List<Ann> = emptyList(), val can_post: Boolean = false, val courses: List<CourseRef> = emptyList())
/** where students struggle */
@Serializable data class Struggle(val topic_id: Int, val topic: String = "", val course: String = "", val students: Int = 0, val questions: Int = 0, val doubts: Int = 0, val not_quite: Int = 0,
                                  val simpler: Int = 0, val flags: Int = 0, val asked: List<String> = emptyList())
@Serializable data class Struggles(val days: Int = 30, val items: List<Struggle> = emptyList(), val courses: List<CourseRef> = emptyList())
@Serializable data class ClassQuestion(val id: Int, val excerpt: String? = null, val mine: Boolean = false, val messages: List<QuestionMsg> = emptyList())
@Serializable data class ClassQuestions(val items: List<ClassQuestion> = emptyList())
/** buying Pro online: the offers the admin set, and the Razorpay page to pay on */
@Serializable data class ProOffer(val id: Int, val days: Int, val price: Double)
@Serializable data class ProOffers(val on: Boolean = false, val currency: String = "INR", val offers: List<ProOffer> = emptyList())
@Serializable data class BuyOut(val id: Int = 0, val url: String? = null)
@Serializable data class ProCheck(val paid: Int = 0, val plan: String = "lite", val pro_until: String? = null)
@Serializable data class AiStatus(val available: Boolean = false, val own_key: Boolean = false, val vision: Boolean = false, val ocr: Boolean = false, val plan: String = "college", val off: Boolean = false)
@Serializable data class You(val order: List<String> = emptyList(), val question_first: Boolean = false, val level: String? = null)
/** a topic step: the gist, why, example, exam angle, quick check or "more simply". data holds the step's own JSON */
@Serializable data class Step(val text: String = "", val cached: Boolean = false, val id: Int? = null, val data: JsonObject? = null, val you: You? = null, val own_notes: Boolean = false)
@Serializable data class Translation(val content: String, val format: String = "markdown")
@Serializable data class Bookmarked(val bookmarked: Boolean)

@Serializable data class Hit(val id: Int, val title: String, val unit: String = "", val course: String = "", val snippet: String = "", val in_title: Boolean = false)
@Serializable data class SearchOut(val q: String = "", val results: List<Hit> = emptyList(), val confident: Boolean = false)
@Serializable data class Answer(val text: String, val cached: Boolean = false, val support: Boolean = false, val via: String? = null)
@Serializable data class PhotoText(val text: String = "", val ocr: Boolean = false)

@Serializable data class Question(val id: Int, val text: String, val options: List<String>, val image: String = "", val option_images: List<String> = emptyList())
@Serializable data class Quiz(val id: Int, val title: String, val pass_percent: Int = 50, val course: String = "", val kind: String = "unit", val questions: List<Question> = emptyList(),
                              val attempts: Int = 0, val best: Int? = null, val latest: Int? = null)
@Serializable data class QResult(val chosen: Int? = null, val ok: Boolean = false, val correct: Int? = null, val explanation: String? = null)
@Serializable data class AttemptOut(val score: Int, val total: Int, val percent: Int, val passed: Boolean, val pass_percent: Int, val reveal: Boolean = false, val results: List<QResult> = emptyList(),
                                    val attempt_id: Int? = null, val summary: String = "", val areas: List<Area> = emptyList())
@Serializable data class AttemptRow(val id: Int, val at: String = "", val score: Int = 0, val total: Int = 0, val percent: Int = 0, val passed: Boolean = false)
@Serializable data class Attempts(val quiz: String = "", val user: String = "", val items: List<AttemptRow> = emptyList())
@Serializable data class AQuestion(val id: Int, val text: String, val options: List<String> = emptyList(), val image: String = "", val option_images: List<String> = emptyList(),
                                   val ok: Boolean = false, val chosen: Int? = null, val chosen_known: Boolean = false, val area: String = "", val correct: Int? = null, val explanation: String = "")
@Serializable data class AttemptFull(val id: Int, val at: String = "", val score: Int = 0, val total: Int = 0, val percent: Int = 0, val quiz: String = "", val pass_percent: Int = 50,
                                     val reveal: Boolean = false, val questions: List<AQuestion> = emptyList(), val changed: Int = 0, val no_detail: Boolean = false,
                                     val areas: List<Area> = emptyList(), val summary: String = "")
@Serializable data class ScoreTest(val id: Int, val title: String, val unit: String = "", val pass_percent: Int = 50, val attempts: Int = 0, val best: Int? = null, val latest: Int? = null,
                                   val passed: Boolean = false)
@Serializable data class ScoreCourse(val course_id: Int, val course: String, val tests: List<ScoreTest> = emptyList(), val taken: Int = 0, val final: Int? = null, val passed: Int = 0)
@Serializable data class Scores(val courses: List<ScoreCourse> = emptyList())
@Serializable data class Insights(val strong: List<Area> = emptyList(), val getting_there: List<Area> = emptyList(), val needs_study: List<Area> = emptyList())
@Serializable data class LearnerOut(val order: List<String> = emptyList(), val level: String = "normal", val taps: Map<String, Int> = emptyMap(), val checks: Int = 0)
@Serializable data class RevTopic(val id: Int, val title: String, val gist: JsonObject? = null, val highlights: List<String> = emptyList())
@Serializable data class Revision(val unit: String = "", val course: String = "", val topics: List<RevTopic> = emptyList())

@Serializable data class Shared(val source: String, val label: String, val uses: Int)
@Serializable data class Rewards(val uses: Int = 0, val points: Int = 0, val toward_next: Int = 0, val per: Int = 1000, val points_per: Int = 100, val top: List<Shared> = emptyList())
/** a self-registered person's AI plan: lite (a free daily allowance on the college's key), own (their own key) or pro (given by the admin until a date) */
@Serializable data class AiPlan(val plan: String = "college", val pro_until: String? = null, val searches_used: Int = 0, val searches_limit: Int = 0,
                                val minutes_used: Int = 0, val minutes_limit: Int = 0, val asked: Boolean = false, val own_key: Boolean = true)
@Serializable data class Profile(val name: String, val email: String = "", val username: String = "", val role: String, val lang: String = "en", val program: String = "", val semester: Int? = null, val term: String = "",
                                 val self_registered: Boolean = false, val ai: AiPlan? = null, val rewards: Rewards? = null)
@Serializable data class Note(val key: String, val text: String, val sub: String = "", val unread: Boolean = false)
@Serializable data class Notes(val items: List<Note> = emptyList(), val digest: Boolean = false, val mail: Boolean = false)
@Serializable data class KeyState(val own_key: Boolean = false, val key_set: Boolean = false, val key_hint: String = "", val provider: String = "deepseek",
                                  val provider_name: String = "DeepSeek", val providers: List<AiProvider> = emptyList())
@Serializable data class AiProvider(val id: String = "", val name: String = "", val console: String = "")
@Serializable data class AndroidRelease(val version: String? = null, val code: Int? = null, val date: String? = null, val url: String? = null)

@Serializable data class LineExplain(val id: Int? = null, val text: String = "")
@Serializable data class Highlight(val id: Int, val text: String, val prefix: String = "", val color: String = "coral", val note: String = "", val explain: LineExplain? = null,
                                   val topic_id: Int? = null, val topic: String = "", val unit: String = "", val course: String = "")
@Serializable data class Highlights(val items: List<Highlight> = emptyList(), val total: Int = 0)
@Serializable data class Explained(val explain: LineExplain)
@Serializable data class Where(val program: String = "", val semester: String = "", val course: String = "", val topic: String = "")
@Serializable data class Doubt(val phrase: String = "", val where: Where? = null, val passage: String = "", val my_passage: String = "", val saved: String? = null, val ai_left: Int? = null)

@Serializable data class SQuestion(val text: String, val options: List<String>, val topic: String = "")
@Serializable data class StudyQuiz(val id: Int, val kind: String, val topic_id: Int? = null, val topic: String = "", val pass_percent: Int = 60, val questions: List<SQuestion> = emptyList())
@Serializable data class Checked(val ok: Boolean, val correct: Int, val explanation: String = "")
@Serializable data class Area(val topic_id: Int? = null, val unit_id: Int? = null, val title: String = "", val percent: Int = 0, val status: String = "", val correct: Int = 0, val total: Int = 0,
                              val study: String? = null, val course: String = "")
@Serializable data class SResult(val chosen: Int? = null, val ok: Boolean = false, val correct: Int = 0, val explanation: String = "")
@Serializable data class StudyAttemptOut(val score: Int, val total: Int, val percent: Int, val results: List<SResult> = emptyList(), val areas: List<Area> = emptyList(),
                                         val summary: String = "", val next_review: String? = null)

@Serializable data class ReadOut(val known: List<String> = emptyList())
@Serializable data class SessionItem(val id: Int = 0, val kind: String = "", val src: String = "", val title: String = "", val done: Boolean = false, val course: String = "",
                                     val reason: String = "", val minutes: Int? = null, val course_id: Int? = null)
@Serializable data class DaySession(val day: String = "", val items: List<SessionItem> = emptyList(), val done: Boolean = false, val caught_up: Boolean = false)
@Serializable data class RoutineOut(val days: String = "1111110", val minutes: Int = 30, val at: String? = null, val new_per_session: Int = 1)
@Serializable data class PlanOut(val left: Int = 0, val finish: String? = null, val late: Int = 0, val advice: String? = null)
@Serializable data class SessionOut(val routine: RoutineOut? = null, val session: DaySession? = null, val planned_today: Boolean = false, val studied_today: Boolean = false,
                                    val missed: Int = 0, val streak: Int = 0, val plan: PlanOut? = null, val next_day: NextDay? = null)
@Serializable data class NextDay(@SerialName("in") val inDays: Int = 0, val weekday: Int = 0)  // the next study day, counted by the server's day (weekday 0 = Monday)

@Serializable data class Source(val name: String = "", val kind: String = "", val words: Int = 0, val paras: Int = 0, val status: String = "", val done: Int = 0, val pages: Int = 0, val error: String = "", val note: String = "")
@Serializable data class SylTopic(val id: Int, val title: String, val has_notes: Boolean = false)
@Serializable data class SylUnit(val id: Int, val name: String, val topics: List<SylTopic> = emptyList())
@Serializable data class Section(val from: Int, val to: Int, val topic_id: Int? = null, val words: Int = 0, val heading: String = "", val excerpt: String = "")
@Serializable data class Material(val sources: List<Source> = emptyList(), val saved_at: String? = null, val syllabus: List<SylUnit> = emptyList(), val sections: List<Section> = emptyList(),
                                  val topics: Int = 0, val covered: Int = 0, val reading: Boolean = false, val ocr_available: Boolean = false,
                                  val ai_available: Boolean = false, val ai_left: Int? = null)
@Serializable data class Preview(val content: String = "")

// a course a student builds from their own material
@Serializable data class StudyRow(val id: Int, val title: String, val status: String = "draft", val share: String = "private", val mine: Boolean = true, val owner: String = "",
                                  val topics: Int = 0, val completed: Int = 0)
@Serializable data class StudyList(val mine: List<StudyRow> = emptyList(), val shared: List<StudyRow> = emptyList())
@Serializable data class StudyNext(val course_id: Int, val course: String = "", val topic_id: Int, val topic: String = "", val done: Int = 0, val topics: Int = 0)
@Serializable data class ReviewCourse(val course_id: Int, val course: String = "", val due: Int = 0)
@Serializable data class StudyMe(val courses: Int = 0, val reviews_due: Int = 0, val review_courses: List<ReviewCourse> = emptyList(), val next: StudyNext? = null)
@Serializable data class PTopic(val title: String, val summary: String = "", val from: Int, val to: Int, val words: Int = 0, val excerpt: String = "")
@Serializable data class PUnit(val title: String, val topics: List<PTopic> = emptyList())
@Serializable data class StudyPlan(val units: List<PUnit> = emptyList())
@Serializable data class Slicing(val running: Boolean = false, val done: Int = 0, val of: Int = 0)
@Serializable data class PlanOutWrap(val plan: StudyPlan? = null, val slicing: Slicing? = null)  // slicing: long material, sliced part by part in the background
@Serializable data class STopic(val id: Int, val title: String, val summary: String = "", val status: String = "not_started", val best: Int? = null, val stars: Int = 0, val due: Boolean = false)
@Serializable data class SUnit(val id: Int, val title: String, val topics: List<STopic> = emptyList())
@Serializable data class StudyCourseFull(val id: Int, val title: String, val status: String = "draft", val share: String = "private", val mine: Boolean = true, val owner: String = "", val classmates_using: Int = 0,
                                         val can_edit: Boolean = false, val notes: String = "", val sliced_by: String = "", val ai_available: Boolean = false, val ai_left: Int? = null,
                                         val ai_own_key: Boolean = false, val reading: Boolean = false, val ocr_available: Boolean = false, val sources: List<Source> = emptyList(),
                                         val paragraphs: Int = 0, val plan: StudyPlan? = null, val units: List<SUnit> = emptyList(), val reviews_due: Int = 0)
@Serializable data class StudyProgressOut(val quizzed: Int = 0, val average: Int? = null, val areas: List<Area> = emptyList(), val summary: String = "")
@Serializable data class SAttempt(val id: Int, val kind: String = "", val score: Int = 0, val total: Int = 0, val percent: Int = 0, val at: String = "")
@Serializable data class STopicFull(val id: Int, val title: String, val content: String = "", val course_id: Int = 0, val course: String = "", val unit: String = "",
                                    val completed: Boolean = false, val has_explain: Boolean = false, val can_edit: Boolean = false, val ai_available: Boolean = false,
                                    val ai_left: Int? = null, val ai_own_key: Boolean = false, val prev: NavTopic? = null, val next: NavTopic? = null, val position: Int = 0,
                                    val total: Int = 0, val attempts: List<SAttempt> = emptyList())

// ---- sign-up for school or college, parents and teachers (role "guardian") and the students they look after
@Serializable data class ProgOpt(val id: Int, val name: String, val term: String = "Semester", val terms: List<Int> = emptyList())
@Serializable data class ProgOpts(val school: List<ProgOpt> = emptyList(), val college: List<ProgOpt> = emptyList())
@Serializable data class GStudent(val id: Int, val name: String, val username: String? = null, val place: String = "", val status: String = "active", val active: Boolean = true)
@Serializable data class GStudents(val students: List<GStudent> = emptyList())
@Serializable data class GCourse(val course: String, val topics: Int = 0, val completed: Int = 0, val opened: Int = 0, val last_active: String? = null,
                                 val tests: Int = 0, val tests_taken: Int = 0, val test_average: Int? = null)
@Serializable data class GProgress(val name: String, val username: String? = null, val place: String = "", val courses: List<GCourse> = emptyList(), val can_reset: Boolean = false,
                                   val program_id: Int? = null, val semester: Int? = null, val scores: WardScores? = null, val activity: WardActivity? = null, val mcq: WardMcq? = null)
@Serializable data class WardArea(val title: String = "", val course: String = "", val percent: Int = 0)
@Serializable data class WardCourseScore(val course: String = "", val percent: Int = 0)
@Serializable data class WardScores(val quizzes_taken: Int = 0, val courses: List<WardCourseScore> = emptyList(), val strong: List<WardArea> = emptyList(),
                                    val getting_there: List<WardArea> = emptyList(), val needs_study: List<WardArea> = emptyList())
@Serializable data class WardDay(val date: String = "", val active: Boolean = false)
@Serializable data class WardRoutine(val days: String = "", val minutes: Int = 0, val at: String? = null)
@Serializable data class WardActivity(val streak: Int = 0, val active_today: Boolean = false, val days: List<WardDay> = emptyList(), val active_days_28: Int = 0,
                                      val active_days_week: Int = 0, val completed_this_week: Int = 0, val routine: WardRoutine? = null)
@Serializable data class GDashItem(val key: String = "", val student_id: Int? = null, val level: String = "later", val text: String = "",
                                   val vars: Map<String, kotlinx.serialization.json.JsonElement> = emptyMap(), val action: String = "progress")
@Serializable data class GWard(val id: Int, val name: String = "", val place: String = "", val streak: Int = 0, val week: List<Boolean> = emptyList(), val active_days_week: Int = 0,
                               val completed_this_week: Int = 0, val last_studied: String? = null, val routine: Boolean = false)
@Serializable data class STarget(val topic_id: Int? = null, val quiz_id: Int? = null, val nav: List<Int> = emptyList())
@Serializable data class SDashItem(val key: String = "", val level: String = "later", val text: String = "", val title: String? = null, val course: String? = null,
                                   val vars: Map<String, kotlinx.serialization.json.JsonElement> = emptyMap(), val action: String = "topic", val target: STarget = STarget())
@Serializable data class SDash(val items: List<SDashItem> = emptyList(), val streak: Int = 0, val week: List<Boolean> = emptyList(), val completed_this_week: Int = 0,
                               val percent: Int = 0, val routine: Boolean = false)
@Serializable data class GDash(val items: List<GDashItem> = emptyList(), val students: List<GWard> = emptyList())
@Serializable data class WardMcq(val sets: Int = 0, val average: Int? = null, val last_at: String? = null, val revisit: List<String> = emptyList())
@Serializable data class Invitation(val id: Int, val name: String, val relation: String? = null, val institution: String = "")
@Serializable data class Invitations(val invitations: List<Invitation> = emptyList())

/** MCQ practice: sets left (Lite one per 48 hours, others four a day), courses and topics with their published questions, a set and its result */
@Serializable data class McqQuota(val tier: String = "", val limit: Int? = null, val used: Int = 0, val left: Int? = null, val next_at: String? = null)
@Serializable data class McqStat(val answered: Int = 0, val correct: Int = 0, val percent: Int = 0)
@Serializable data class McqTopic(val id: Int, val title: String, val unit: String = "", val questions: Int = 0, val stats: McqStat? = null)
@Serializable data class McqCourse(val id: Int, val name: String, val semester: String = "", val questions: Int = 0, val topics: List<McqTopic> = emptyList())
@Serializable data class McqOpen(val id: Int, val total: Int = 0, val answered: Int = 0)
@Serializable data class McqHome(val quota: McqQuota = McqQuota(), val ai: Boolean = false, val min: Int = 3, val max: Int = 20, val open: McqOpen? = null, val courses: List<McqCourse> = emptyList())
@Serializable data class McqQ(val pos: Int, val topic: String = "", val text: String = "", val options: List<String> = emptyList(), val image: String = "", val option_images: List<String> = emptyList(),
                              val chosen: Int? = null, val correct: Int? = null, val explanation: String = "", val explanation_image: String = "", val ok: Boolean = false)
@Serializable data class McqFeedback(val topic_id: Int? = null, val topic: String = "", val correct: Int = 0, val total: Int = 0, val percent: Int = 0, val status: String = "")
@Serializable data class McqSet(val id: Int, val mode: String = "", val source: String = "", val status: String = "", val total: Int = 0, val resumed: Boolean = false, val score: Int? = null,
                                val percent: Int? = null, val submitted_at: String? = null, val questions: List<McqQ> = emptyList(), val feedback: List<McqFeedback> = emptyList())
@Serializable data class McqHistItem(val id: Int, val mode: String = "", val source: String = "", val status: String = "", val topic: String = "", val course: String = "", val score: Int? = null,
                                     val total: Int = 0, val percent: Int? = null, val at: String? = null)
@Serializable data class McqHist(val total: Int = 0, val items: List<McqHistItem> = emptyList())

/** an admin's view of a student's AI plan, from /admin/users: who asked for more, and who is on Lite or Pro */
@Serializable data class PlanUser(val id: Int, val name: String, val email: String? = null, val username: String? = null, val role: String = "", val program: String? = null,
                                  val plan: String = "", val pro_until: String? = null, val asked: Boolean = false)
@Serializable data class PlanUsers(val total: Int = 0, val items: List<PlanUser> = emptyList())

// the calendar (GET /calendar): events people added, and what Zigora knows (deadlines, sessions, days studied, results)
@Serializable data class CalEvent(val id: Int, val notes: String = "", val scope: String = "user", val user_id: Int? = null, val course_id: Int? = null, val can_edit: Boolean = false)
@Serializable data class CalItem(val id: String, val kind: String, val date: String, val end: String? = null, val at: String? = null, val title: String = "", val sub: String = "",
                                 val state: String? = null, val event: CalEvent? = null, val link: JsonObject? = null) {
    val join: String? get() = (link?.get("join") as? kotlinx.serialization.json.JsonPrimitive)?.content  // a class's video link
    val classId: Int? get() = (link?.get("class") as? kotlinx.serialization.json.JsonPrimitive)?.content?.toIntOrNull()  // its class, so Join is counted
}
@Serializable data class CalWho(val id: Int, val name: String)
@Serializable data class CalResp(val items: List<CalItem> = emptyList(), val today: String = "", val student: CalWho? = null, val students: List<CalWho> = emptyList())
@Serializable data class CalLink(val on: Boolean = false, val path: String? = null)
