# Zigora
Multi-user engineering study app: FastAPI + MariaDB/MySQL + React PWA. DeepSeek explains topics and writes sample answers; results are cached centrally so each topic costs tokens once.

## Production first run
1. DB: `CREATE DATABASE engtutor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON engtutor.* TO 'app_user'@'localhost'; FLUSH PRIVILEGES;`
3. `cp .env.example .env` and fill it in.
5. `./run.sh` (installs deps, builds the UI, starts the app under pm2; serves API and UI on HOST:PORT)
6. Sign in as the admin, add the DeepSeek key under Admin, then add students.

The PWA installs only over HTTPS (or localhost), so put the app behind a TLS reverse proxy.

## Topic content: Markdown, HTML, or HTML with JavaScript
In the topic editor, **Fill from files** takes the content as a Markdown `.md` file (a plain file is the content; one with the config sections fills the other boxes too) or an HTML file, with any images it uses. The content format has three choices:
- **Markdown** and **HTML**: HTML is cleaned when it is saved (no scripts or styles), so it takes the app's look.
- **HTML + JavaScript**: choose this before picking the file to keep the page whole, scripts and styles included. It runs only in a sandboxed frame (`GET /api/topics/{id}/frame`, served with `Content-Security-Policy: sandbox allow-scripts` and no same-origin), so its scripts work but can't read the app's sign-in, call the API as the reader or change the app's page. The frame is reached with a pass that is good for that one topic for 8 hours and is never accepted as a sign-in. A sandboxed page also can't keep data in the browser (localStorage) between visits. Search and the AI read only its words, never its scripts.

**Many topics at once:** on a unit, **Upload topic files** takes several `.html`/`.md` files, or a whole folder (its images are matched by file name), and makes one topic per file in file-name order. It shows what each file becomes first; you choose drafts or published, and whether to keep each page's JavaScript.

**Interactive pages remember.** A sandboxed page can't use the browser's storage, so the app gives it a stand-in: `localStorage` works as usual, starts with what that student saved last time, and each change is saved on the server for them (up to 100 KB per page per person; `sessionStorage` lasts while the page is open). It follows the student to other devices.

A topic opens on its page: the gist first, then the steps and the notes. **Read in full screen** opens the **full-screen reader** (with a button for the browser's own full screen). Anyone can select text and press **Highlight** to save it; tapping a highlight offers **Remove highlight**. Highlights come in four colours (coral, yellow, green, blue) and can carry a note. **My highlights** in the menu lists all of them across topics, with search and a colour filter. Highlights are saved per person (`/api/topics/{id}/highlights`, `DELETE /api/me/highlights/{id}`), listed in the reader's side panel and under the topic's notes, and come back each time the topic is opened. A highlight is stored as its text plus the words just before it, so it is found again even if the topic is edited elsewhere.

## Diagrams (Pro)
A teacher can turn on **Diagram for students on Pro** in a topic's editor, and say what it should show ("the lime-soda process as a flow"). Students then get a **Diagram** step beside Why?, Example and the others: the AI draws an interactive diagram (an HTML page: an SVG drawing with parts to tap and steps to walk through) from the topic's notes, once per topic and language, and everyone shares it. It opens full screen, on the web and in the Android app. Students on Lite (and students whose AI is off) see the step with a lock: diagrams come with Pro, an own AI key, or a college account. The page runs in a sandbox stricter than a teacher's interactive page: its own scripts and styles run, but it can't load anything from anywhere and can't reach the app (`GET /api/topics/{id}/diagram`, then `/diagram/frame`). The prompt is editable under Settings > AI prompts ("Topic diagram (Pro)"). A new note, new notes or another language draws it again.

## Ask the teacher
A student who is stuck taps **Ask my teacher** on a topic, or **Still not clear? Ask my teacher** under "Not clear?" on a phrase they highlighted (the phrase goes with the question). The question goes to the course's owner, or to every admin when the course has none; nobody else can read it. Unlike "This looks wrong?", it is not anonymous: the teacher sees who asked. Teachers answer under **Student questions** in the menu (waiting ones first, oldest first), and the dashboard, the bell and an email tell them a question is waiting. The student finds the answer under **My questions** on the web, or **Saved > Questions** in the Android app; the bell and an email tell them it has come. Either side can reply until one of them closes the question. Limits: 10 new questions a student a day, 1000 characters a message, 30 messages a thread.

- **Photos and maths:** a question or a reply can carry a photo (working on paper, a diagram), shrunk on the device with its location data dropped. Maths written between dollar signs (`$x^2$`) shows as formatted equations, on the web and in the app. Photos sit under `uploads/questions` behind unguessable links; at most 20 a person a day.
- **Lite students:** asking the teacher comes with Pro (or an own AI key, or a college account). Students on Lite see the button with a lock and a note on how to get Pro.
- **Already answered:** while a student writes a question, answers the teacher already shared with the class that look like it (on the topic first, then the rest of the course) show first, so they may not need to send it. Words in common decide; nothing goes to the AI.
- **Shared with the class:** once a question has an answer, the teacher can **Share with the class**. Everyone studying the topic then sees it under **Questions from your class** on the topic, with the answers but without the name of the student who asked. The teacher can stop sharing at any time.
- **On the phone:** the Android app checks every 15 minutes or so (Android's shortest interval for background work) and shows a notification when a teacher answers. Tapping it opens the question. The app asks for permission to notify the first time a student sends a question.

## Courses a teacher offers
Besides the courses in programs, a teacher can run a course of their own: faculty and admins, and school teachers (parent/teacher accounts that signed up as teachers). Menu: **Offered courses** (for admins under Courses).
- **Offer a course** with a name, what it is about, and a start and end date if it has them. Choose who may join: **students I accept** (by invitation, and optionally students may ask to join) or **anyone, at once**.
- Only the students on a course's list see it, from any program. They find it in **My courses** under "Offered courses"; nobody else sees it, even in the same program.
- **Invite** students by email or username: each gets an email and a note in the bell, and has **48 hours** to accept (Home shows the invitation with the hours left; **Join a course** in the menu and in the app's Courses lists it). An answer not given in time lapses; invite again.
- **Dates at work**: before its start date students on the list see the course's name and start date, nothing inside (the teacher prepares it); classes must fall within its dates; the day before it starts its students and teacher are reminded, and three days before it ends its students are; once it has ended its enrolled students are marked completed (they can still look back) and told, unanswered invitations and requests lapse, and no one new can be invited or join until the teacher changes the end date or repeats it.
- **Who may offer**: faculty, admins and school teachers. A school teacher who signs up waits for an admin's approval before they can sign in (admins are emailed and see it on their dashboard: approve or decline on the teacher's page); parents and students sign up as before. Admins can also make any type of account themselves: student, faculty, admin, parent or school teacher (one by one, or with a role column of student, faculty, admin, parent or teacher in the CSV).
- **Asking to join**: students find courses that take requests (and open courses) under Join a course. The teacher is told and has **48 hours** to accept or decline.
- **The course's students** page: keep (restore), suspend (they can't open it until restored), mark completed (they can still look back), release (they lose it), or take back an invitation. Every change tells the student.
- **Repeat** a course: a new run with the same units, topics and quizzes, model answers and question bank, new dates, and the same students invited again or nobody yet. **Cancel** a course: its students lose it, pending invitations and requests are cancelled, its classes still to come are cancelled, everyone is told. **Archive** hides it without cancelling. **Pause** a course: its students keep their place but can't open it, and nobody can join, until the teacher resumes it; students are told both times.
- **Leave a course**: a student taps **Leave the course** on its Join page (web and app). Their work so far is kept and they can ask to join again.
- Content (upload, edit, publish, unpublish), classes and announcements, student questions and where students struggle work as for any course.
- **Write to students**: a message to all of a course's students or the ones ticked; each gets it in My questions (and a notification) and can answer the teacher there. Any course's teacher can do this. **Attach material**: a PDF, Word, PowerPoint, Excel, text, CSV, ZIP or picture, up to 15 MB, which students download from the message.
- **Offer help** (Where students struggle): writes to every student who was stuck on a topic lately; the teacher learns how many, never who.
- **Change a class's time**: a new date, time, length or link; it moves in every calendar and students and parents are told.
- **Needs your attention** (a school teacher's home page): students asking to join, questions waiting for an answer, today's classes and topics students got stuck on this week, each a tap from the page that deals with it.

## The admin's menu
Seven sections: **Courses** (Courses, Programs, Reports, Where students struggle), **Teachers** (Teachers, Classes and announcements, Student questions), **Students** (Students, Parents and school teachers), **Tests** (Assigned tests, MCQ bank, MCQ practice), **Calendar**, **Settings** (Settings, All users, Activity log) and **About**. Each opens on its first page, and the section's other pages are tabs along the top, so every page is one tap away; the dashboard's links still go straight to the page they name.

## For teachers: classes, announcements, struggles and model answers
- **Classes and announcements** (menu, web and app): a course's teacher (or an admin) posts a note to the class, or schedules a class with a video link. Zigora doesn't host video: make a Google Meet (or Zoom) link, paste it in, and students join from Zigora when it starts. A class goes into the calendars of the course's students, their parents and the teacher (and the phone calendar link), and students are told by email, in the bell and on the phone; parents by email and in the bell; admins in the bell. Cancelling a class takes it out of the calendars and tells them.
- **Weekly classes:** tick **Repeat every week** and choose how many weeks (2 to 26). Every session is its own class and calendar entry, in every calendar; students and parents are told once, for the whole series. The list shows the next session ("Weekly, session 3 of 8"). Cancelling asks: only this session, or this and every later one.
- **Reminder 10 minutes before:** the Android app sets an alarm on the phone for each class coming up in the next week (no push service), and shows "Class in 10 minutes" with a Join button. It takes back the alarm of a class that is cancelled. Android may deliver it a little late when the phone is asleep.
- **Who tapped Join:** when a student taps Join (in the list, the calendar or on Home), Zigora notes it before opening the video link. The teacher sees "Tapped Join: 18 of 25" with the names under each class. It is a rough attendance: Zigora can't see who stayed in the call.
- **Where students struggle** (menu, web and app): per topic of the teacher's courses, over the last 7, 30 or 90 days, what students did when stuck: questions to the teacher, Not clear? on a phrase, Not quite after a quick check, asking for it more simply, and flagged answers, with the questions they asked. Counts only, never names.
- **Model answer with marks**: on a topic's Sample answer tab, the teacher writes the exam question and the answer in parts, each with its marks. Students see it first, above the AI's sample answer, with the total; it is kept for reading offline.
- **In the Android app**: teachers and admins sign in to Questions (answer, add a photo, share with the class, close), Classes (post, schedule, change a class's time, cancel), Courses (offered courses: offer, invite, accept or decline requests, manage students, write to students with a file, pause, repeat, archive, cancel), Struggles (with Offer help) and Me; a school teacher also has Students. A phone notification tells them when a student asks. Units, topics, tests and settings stay on the website.

## Reading offline
What a student has opened stays readable without a connection, so nothing is asked of the server, or the AI, a second time: a topic's notes, its AI steps (the gist, Why?, Example and the rest), its translation, highlights and diagram, the questions from the class, the course list and the student's own questions. The Android app keeps them in its own storage; the web app keeps them in the browser (Cache Storage, with the app itself kept by its service worker). A line under the header says when it is showing kept copies. Signing out forgets them all. Anything that needs the server (practice, quizzes, a new AI step, saving a highlight) needs a connection by design. When the server can't be reached the app says so plainly under the header, and when a request is still waiting after 12 seconds it says the connection may be slow.

## Buying Pro online (Razorpay)
Students who signed up themselves can buy Pro from their profile, on the web and in the Android app, instead of waiting for an admin. To switch it on, open **Settings > Payments** and:
1. Paste your Razorpay **key ID** and **key secret** (Razorpay Dashboard > Account & Settings > API keys). Start with test keys (`rzp_test_…`), then change to live keys. The secrets are stored encrypted and never shown again.
2. In Razorpay, under **Webhooks**, add the address shown there (`…/api/pay/webhook`) for the event `payment_link.paid`, with a secret of your choice, and paste the same secret as the **Webhook secret**.
3. Set the currency (INR by default) and up to six **Pro offers**, for example 30 days for 149 and 365 days for 999. Save, then **Test the keys**.
4. Set the site address under **Settings > Email**, so Razorpay sends students back to the app after paying.

A student picks an offer and pays on Razorpay's own page (card, UPI, netbanking or wallet); the app never sees card details. Pro starts as soon as Razorpay confirms the payment, whichever arrives first: the signed return to the app, the webhook, or the app asking Razorpay when the student comes back. Each payment adds its days once, on top of any Pro still running, and the student gets an emailed receipt. Payments received are listed under Settings > Payments.

## Notifications
The bell shows what needs doing: for staff, the Home page's "Needs attention" items; for students, overdue and due-soon topics and tests not tried or not passed. The badge counts only new ones; opening the list marks them seen, and an item comes back as new when it changes (for example, more drafts). When email is set up (SMTP in `.env`), anyone can tick **Email me a daily summary** in the bell: once a day, after `DIGEST_HOUR` (default 7, local time per `DAY_OFFSET_MINUTES`), they get an email listing their new notifications, and nothing when there are none.

## Languages: English, Arabic and Tamil
Everyone picks their language with the switch in the header (and on the sign-in page): English, العربية or தமிழ். The choice is saved to their account (`PUT /api/me/lang`) and on the device; a first visit follows the browser's language. Arabic turns the whole app right to left (the side menu moves to the right, arrows for back and next turn round). Arabic and Tamil text use Noto Sans, downloaded only when needed.

- **How text is translated:** the screens are written in English and every piece of text goes through `t()` (`frontend/src/i18n.js`), which looks it up by its English wording in `frontend/src/locales/ar.json` and `ta.json`. Anything not in the dictionary shows in English. `{name}`-style placeholders are filled in at run time and may sit anywhere in a translation. Messages from the server are looked up the same way, so the common ones are translated; rare ones and emails stay English.
- **Fixing or adding a translation:** edit the JSON file (the key is the exact English text). The translations were made with AI help; have a native Arabic and a native Tamil speaker review them before students use them.
- **AI answers** (Explain, Sample answer, AI search, explanations and practice questions in student-built courses) come in the person's language. Saved answers are kept per language, so each language costs AI tokens once per topic.
- What people type (topic content, course and program names, highlights) is never translated.

## Name, logo and colours
The app is called Zigora (formerly Eng Tutor). The name comes from `APP_NAME` in `.env`; an older `.env` may still say `APP_NAME="Eng Tutor"`, so change it there and run `./run.sh`. An admin can also set another name and logo under Settings, which wins over `.env`. Without a custom logo the app shows the Zigora mark (`frontend/public/favicon.svg`; the PNG icons beside it are drawn from the same shape). The colours are Calm blue: blue `#2563eb` (buttons, links, the mark), amber `#f59e0b` (one accent), ink `#0f172a` and slate `#475569` text on a cool off-white `#f8fafc` with white cards, set as variables at the top of `frontend/src/styles.css` (the Android app uses the same in `ui/Theme.kt` and `res/values/colors.xml`). Both the website and the app are light unless the user picks Dark (the sun/moon button on the website, Me → Theme in the app); neither follows the phone's dark mode or wallpaper colours. The pm2 process and the database keep the name `engtutor`, so existing servers carry on unchanged.

## Managing users from the terminal
`./manage.sh add --name "Name" --email a@b.com [--role admin]` (prompts for the password), `passwd`, `enable`, `disable`, `role`, `list`. Use `VENV=/path/to/venv` if your venv is not `./venv`.

## Under a folder of the address (BASE_PATH)
To run Zigora at `https://apps.perennia.org/zigora` instead of at the root of an address:
1. `.env`: `HOST=127.0.0.1`, `BASE_PATH=/zigora`, `APP_URL=https://apps.perennia.org/zigora`, then `./run.sh`. If a site address is saved in Settings, give it the folder too.
2. The reverse proxy passes the folder through unchanged (no path after the port in `proxy_pass`). In CloudPanel: the site's **Vhost**, inside the `server { listen 443 ... }` block:
```
location /zigora/ {
  proxy_pass http://127.0.0.1:5252;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 180s;
  client_max_body_size 30m;
}
location = /zigora { return 301 /zigora/; }
```
3. The home page is `/zigora/`, the app `/zigora/app/`. Android: the server address is `apps.perennia.org/zigora`. Google's Authorized JavaScript origin is the address without the folder (`https://apps.perennia.org`).

Saved links (pictures in topics, the logo) stay `/api/uploads/...` in the database, so moving the site between the root and a folder needs nothing else. The server still answers without the folder on `127.0.0.1:5252` (run.sh uses that).

## Sign in with Google
Off until a Web client ID is set (Settings → Access, or `GOOGLE_CLIENT_ID` in `.env`). Works on the web and in the Android app; an account with the same email is linked on its first Google sign-in, and with self-registration on a new Google email can sign up without a code. Setup steps for the Google Cloud project (owned by Cogzidel Technologies): [docs/google-sign-in.md](docs/google-sign-in.md).

## Admins and passwords
No account is created automatically. Create or reset the admin (creates it if missing, otherwise resets the password and makes sure it is an active admin):
`./manage.sh admin --email you@example.com`. Reset any user with `./manage.sh passwd --email x@y.com`, or from the Admin tab in the app (Reset).

## Content
Structure: Program > Semester > Course > Unit > Topic. Admins build and change programs, semesters and courses; each course's faculty owner looks after its units and topics; students read and learn.
Upgrades are automatic: earlier "courses" become programs, their "subjects" become courses inside a "Semester 1", and loose topics go into a "General" unit. (Table names are unchanged: `courses` = programs, `subjects` = courses.)

## Programs
Admin > Programs works like Users: a table of programs with course and student counts, search (program, semester or course name), sorting, and New program. Tap a row for the program's page: its semesters in order, Add semester, enrolled students, Rename, Delete (with a warning of what goes with it) and Open semesters and courses. Program names must be unique, because the users CSV import matches programs by name. Deleting a program un-enrols its students but keeps their accounts.

## Building the structure (admins)
Everything is made from where it belongs. In Learn (or from a program's page): the programs list has **New program**; inside a program, **Add semester** asks for its number (1 to 8) and a name; inside a semester, **Add course** asks for a name and the faculty owner. A course page shows its program, semester and owner, with **Edit course** (rename, move to another semester, change owner) and **Change owner**. The pencil on a program, semester or course edits it in place; the trash icon deletes it after saying exactly what goes with it.

A semester's **number** is stored data, not read from its name: it decides the order semesters are listed in and which students see them (a student in semester 3 sees semesters 1 to 3). Each number is used once per program. On upgrade, migration 0010 fills the number from each existing semester's name when that is unambiguous; any it can't fill show "No semester number set" and are listed by `./manage.sh integrity`. Until numbered, such a semester is visible to every student of the program, as before.

Moving a course to another semester also moves it to that semester's program, with its units, topics, quizzes and owner.

## CSV import (content)
Admin > Programs > Bulk upload. Columns: `program, semester, course, unit, topic` plus optional `semester_no, content, question_pattern, sample_content, guideline`. A new semester takes `semester_no`, or else the number in its name if that number is free in the program; otherwise it is created without a number and the preview says so. Imported courses have no owner until an admin assigns one. Blank hierarchy cells repeat the row above; existing names are reused and existing topics are updated. A preview shows what will change before anything is saved.

## Name and menu
The app name comes from `APP_NAME` in `.env` (login screen, top bar, drawer, installed app name). The drawer menu (top left) has Learn, and for admins Users, Programs, AI config, Reports and About.

## Bookmarks
Students and faculty can bookmark a topic with the bookmark icon at the top of the topic page (tap again to remove it). Admins manage content and have no bookmarks. Each bookmark is one topic, never its unit or course. Bookmarks are private to each user. The Bookmarks page in the drawer lists only the topics you saved: pick a semester or year, then a course tab, and its saved topics appear under their unit headings (units with nothing saved are left out). Bookmarked topics also carry a small bookmark mark in the Learn lists. The `bookmarks` table is created automatically on start.
- **Archive and restore**: programs, semesters or years, courses, units and topics can be archived instead of deleted. Archiving hides an item and everything under it; nothing is removed, and reading progress, bookmarks and quiz results are kept. Students see an archived course as a locked name with "Unavailable right now" and cannot open anything in it. Archived topics and units simply disappear for students. Admins can archive and restore at every level; the faculty owner of a course can archive and restore that course and its units and topics, but not programs or semesters. An item archived because its parent is archived can only be restored by restoring the parent first. Restoring a parent brings back everything that was archived with it, while items archived on their own stay archived. Archived courses and topics are left out of the dashboard numbers, reports and attention lists. Staff see archived items hidden by default with a "Show archived" tick, and the Programs page has an Active, Archived and All filter. API: `PUT /api/{programs|semesters|courses|units|topics}/{id}/archive` with `{"archived": true|false}`; the `archived_at` columns are added by migration 0017.

## Users
Admin > Users is a table of name, program and semester (1 to 8). Search matches name, email, role, program or semester ("3", "sem 3"), and you can filter by program or semester and change the sort order. Tap a row to open the user's page: profile, reading activity, Edit, and Reset password (creates a new random password, shown once with a Copy button). New and edited users can be enrolled in a program and semester. Students see their own program, up to and including their current semester; a student with no program sees no programs, courses or topics until you enrol them. You can't change your own role or status.
Bulk upload takes a CSV with `name,email,password,role,program,semester`. Blank passwords are generated and offered as a one-time download. Program must match a name on the Programs tab; semester is 1 to 8 (`3`, `S3` and `Semester 3` all work). Existing emails are updated, and blank program or semester cells leave the current value alone.
Older databases upgrade automatically: two nullable columns (`users.program_id`, `users.semester`) are added on start.

## Seed content
`content/engg_chem_unit1_water_treatment.csv`: B.E Mech > Semester 1 > Engg. Chem > Unit 1 - Water Treatment (31 topics). Load it from Admin > Programs > Bulk upload (check the preview, then confirm). Enrol students in program "B.E Mech", semester 1 to match.

`content/mbbs_year2_pathology.csv`: MBBS > Year 2 > Pathology, six units and 21 topics written for the way Zigora teaches: one idea per topic, notes in Markdown (terms first, then how it works, then the applied detail and tables), and the gist, Why?, Example, Exam angle and Quick check made from those notes as for any topic. 14 topics carry a `diagram_note`, which turns on **Diagram for students on Pro** with what to draw (the AI draws it); students on Free read the same notes without it. `docs/syllabi/mbbs-year-2.csv` has the units of all three Year 2 courses (Pathology, Pharmacology, Microbiology).

**Replace the whole catalogue** (production): `./manage.sh replace-catalog docs/syllabi/mbbs-year-2.csv content/mbbs_year2_pathology.csv`. It checks the files first and stops if a row is wrong, says how many programs, courses and topics it will delete, asks you to type DELETE, makes a backup (`./manage.sh backup`, as the app's own database user), deletes every program and course with their units, topics, quizzes and the students' progress and results in them, then imports the files in order. Users and students' own built courses stay; students lose their program and year, so set them again on the Students page (or they choose it when they next sign in). The content CSV import also takes an optional `diagram_note` column, and a row with no topic adds just the unit.

## Passwords
Everyone can change their own password from the drawer (Change password). Passwords an admin sets or generates (new user, bulk upload, Reset, CLI add/passwd) are temporary: the student must choose their own on first sign-in, and the app blocks everything else until they do. Admins changing their own password are not forced. The `users.must_change` column is added automatically on start; existing users are not forced.

## Common courses
A course lives in one home semester, but can also be shown in other programs' semesters (for example first-year Engg. Chem for every branch). As admin, open a semester and tap the link icon on a course, then tick the semesters that should also show it. You edit it only at its home; the other semesters show it marked "shared from ...". Removing a shared card (trash icon) only unlinks it there. Students see a shared course like any other and are scoped by their own program and semester. Deleting the home course or a linked semester cleans up the links.

## Faculty role
Roles are student, faculty and admin. Faculty can read all published content and see drafts only in the courses they own. They cannot create, edit, move or delete programs, semesters or courses, share courses, manage users, upload CSVs, or change settings, and the server enforces that. Create faculty from Users (role Faculty), the bulk user CSV (`role` column) or `manage.py add --role faculty`. Like students, faculty must set their own password on first sign-in. On sign-in faculty see **My courses** first, above the full program list.

## Course workspace (faculty)
Faculty open **My courses** and then a course. The course page shows its program, semester and owner, and **Add unit**; inside a unit, **Add topic** opens the topic editor (Markdown, equations, images, Preview) already placed in that unit. Units and topics have up/down arrows; the order is saved and is the order students see. A topic page has **Edit topic** and **Publish/Unpublish** for its owner. Faculty can rename and delete their own units and topics and move a topic between units of the same course; moving a unit to another course, or a topic out of its course, is left to admins. Deleting a topic or unit also deletes its students' reading progress, bookmarks and saved AI answers (and a unit's quizzes and attempts); the confirmation says so. Migration 0011 adds `units.position` and `topics.position`, filled in the existing order.

## Learning deadlines and progress
A topic can have a **learning deadline**, set or removed by its course's owner or an admin in the topic editor ("Learning deadline", or "No deadline"). It is stored as one instant (UTC, like every time in the app) and shown in each reader's own time zone; the API takes ISO 8601 with a time zone (`2026-10-05T17:00:00+05:30` or `...Z`). Past deadlines are allowed and never moved. A deadline does not lock anything: after it passes, a student who hasn't completed the topic sees **Overdue** and can still read and complete it.

Each student's state per topic is **Not started** (never opened), **In progress** (opened) or **Completed** (they tapped **Mark as completed**; the time is kept, and "after the deadline" is shown when it was late). Opening a topic never completes it and never undoes a completion; only **Mark as not completed** does. Overdue and late are worked out from the deadline and the completion time, not stored. Unit and course counts ("3 / 5 topics completed") are counted from these states. In a unit, a course's owner sees per topic how many of the course's students completed it and how many are overdue. There is one progress row per student and topic (a unique key), so repeated or simultaneous clicks can't duplicate it. Migration 0012 adds `topics.learning_due_at` and `progress.completed_at`; existing topics get no deadline, and students who had opened a topic are In progress, not Completed.

## Course owners
Admins create courses; each course has **one owner**, an active faculty member, who adds, edits, deletes and publishes its units, topics and quizzes. No other faculty member can edit it (admins always can). A course may be left with "Owner not assigned" until an admin picks one; until then only admins edit it.

Set the owner in any of three places. They all change the same field (`subjects.faculty_owner_id`): the Owner box when adding or editing a course; Programs > open a program > pencil beside a course; or Users > open a faculty member > Assign courses (ticking a course someone else owns moves it to this person). Changing or removing an owner never touches units, topics, quizzes or student progress.

Owners are never replaced automatically. If an owner is disabled or stops being faculty, they stay on record but can't edit; the course shows "Owner ... is disabled" or "... is no longer faculty", and saving that change on their page says how many courses need a new owner.

Upgrading: migration 0009 makes the single assigned faculty member of each course its owner. It does not choose when a course had several assigned faculty, none, or one who is no longer active faculty. `./manage.sh owners` lists those courses with the people who used to be assigned. The old `course_faculty` rows are kept but no longer give anyone edit rights. The `owner_id` columns on programs, semesters, courses, units and topics record who created the row (`created_by` in the code); they are not owners.

## Equations and images in content
Topic content is Markdown with math: `$x^2$` inline, or a block with `$$` on its own line above and below. Chemistry uses mhchem, for example `$\ce{CaCO3 + CO2 + H2O -> Ca(HCO3)2}$` (`v` is a precipitate arrow, `^` a gas arrow). In the editor, **Add image** uploads a PNG, JPG, GIF or WebP (max 3 MB) and inserts it at the cursor; **Preview** shows the result. Admins and faculty can upload. Files are saved in `backend/uploads` (set `UPLOAD_DIR` to move it) and must be backed up with the database. Images are served without sign-in (random names) because `<img>` tags can't send a login token. If a reverse proxy sits in front, allow request bodies of at least 3 MB (nginx `client_max_body_size 4m`). A literal dollar sign in content may need escaping as `\$` when a second one follows in the same paragraph.

## Draft and publish
Topics have a Published flag. Drafts are visible to admins and the course's owner only: students don't see them in the course list, and opening, reading, bookmarking or asking the AI about a draft returns "not found". In the editor, tick "Published" (it starts unticked for faculty and ticked for admins). In a unit, the eye icon on a topic publishes or unpublishes it, and "Publish all N drafts" publishes the whole unit. Faculty can publish topics in their own courses, and the topic page has Publish/Unpublish buttons. Saving a topic's content never changes whether it is published. Topics created by CSV import are published. Existing topics stay published when the `topics.published` column is added on start.

## Security settings
- **JWT_SECRET** is required (32+ random characters). The app refuses to start without it, and `run.sh` generates one if it is missing or still the placeholder.
- **Sign-in lockout:** 5 wrong passwords per account from one address, 20 per account, or 200 per address inside 15 minutes returns "try again in 15 minutes". The same limit guards the current-password check when changing a password.
- **Sessions** last `TOKEN_DAYS` (default 7) and end whenever the password changes, is reset by an admin, or the account is disabled. Changing your own password keeps you signed in on that device.
- **The Android app for students:** a student who signed up completes their profile once after first signing in (course of study if not placed, then Free, Pro or an own AI key; Free shows "AI costs us money: Get Pro / Continue free", which closes by itself after 4 seconds). Children a parent or teacher added are not asked. The app's logo (top left) or a swipe from the left edge opens a menu drawer; the bottom bar keeps Home, Courses and Me. Courses lists the program's courses, then courses by teachers. A topic opens one step per screen (the gist, Why?, Example, Exam angle, Quick check, the notes, then I've learned this), with Full page for the usual topic page.
- **Staying signed in on the Android app:** the app makes a random id for its install once (not a hardware id) and sends it with every request. A sign-in made in the app is tied to that install and lasts `DEVICE_TOKEN_DAYS` (default 365); while the app is used the server renews it at most once a day (the `X-Zigora-Token` response header), so the person is not asked to sign in again on the same install. They are asked again if they sign out, reinstall the app or clear its data (a new id), their password changes or is reset, their account is switched off, or the app goes unused for `DEVICE_TOKEN_DAYS`. The same sign-in sent without the install's id is refused. The website is unchanged.
- **Password hashing** is PBKDF2 with 600,000 rounds (`PBKDF2_ITER`). Old hashes upgrade automatically at the next sign-in. One-time passwords made by bulk upload use fewer rounds and are replaced by the full-strength hash when the user sets their own.
- **CORS** is off (same-origin). Set `ALLOWED_ORIGINS` only if the front-end is served from another site. Responses carry CSP, nosniff, frame-deny and referrer headers, and HSTS over HTTPS.
- **GET /api/health** returns 200 when the database answers, 503 otherwise, for uptime monitors.

## Operations
- **Tests:** `cd backend && pip install -r requirements-dev.txt && python -m pytest`. They run on a throwaway SQLite database and cover scoping, faculty permissions, drafts, common courses, passwords, lockout, uploads, import, migrations, the audit log and backups. GitHub Actions runs them and builds the front-end on every push (`.github/workflows/ci.yml`).
- **Migrations:** schema changes are numbered entries in `MIGRATIONS` in `backend/main.py`. Each runs once, is recorded in the `schema_migrations` table, and is safe on a database that already has the change. Add new ones at the end. They apply on start; `./manage.sh migrate` applies them and lists what is applied.
- **Backups:** `./backup.sh` writes a compressed database dump (`mysqldump` for MariaDB/MySQL, the SQLite backup API for SQLite) and a tarball of `uploads/` into `./backups` (or `BACKUP_DIR` / `--dir`), and deletes copies older than `--keep-days` (default 14). Schedule it, for example `30 2 * * * /path/to/iniyavan/backup.sh >> /var/log/engtutor-backup.log 2>&1`, and copy the folder off the server. The MariaDB client tools (`mysqldump`) must be installed.
  Restore: `gunzip < engtutor-DATE-db.sql.gz | mysql -u USER -p DBNAME`, then `tar -xzf engtutor-DATE-uploads.tar.gz -C backend/` to bring the images back.
- **Activity log:** every create, edit, delete, publish, share, import, upload, password reset and password change by a signed-in user is recorded with who, when, what and whether it was allowed (blocked attempts show as "Not allowed"). Admins read it under Activity log, with search. Request contents and passwords are never stored, and entries older than 400 days are removed. Students opening or bookmarking topics are not logged here (that is the reading progress).

## Quizzes
Admins and faculty (for their own courses) add multiple-choice quizzes to a unit: open the unit, tap **Add quiz**, set a title and pass mark, write questions with 2 to 6 answers, tick the correct one and add an optional explanation (Markdown and `$math$` work). A quiz stays a draft until **Published** is ticked. Students open it from the unit, answer, and are graded on the server, so the correct answers are never sent to the browser before they submit. They then see their score, pass or fail and which of their answers were right; the correct answers and explanations are sent to students only when the quiz is set to show them (admins and the course's faculty always see them). Students can try again as often as they like; the best score shows on the unit. Quizzes follow the same program and semester rules as topics and disappear with their unit or course.

## Students bring their own notes to a course
The college sets the framework: program, semester, course, units and topics. A course can be just that framework (topic titles and order, no content), so staff don't have to write or format every topic. Each student brings their own material for it.

On a course page a student taps **Bring your own notes** (later **Your notes in X of Y topics**):
1. **Your files:** add PDFs (with selectable text), Word (.docx) or text files, or paste text. Several files are joined in order.
2. **File it under the syllabus:** **Match with AI** cuts the material into parts and puts each under the course topic it is about, judging by meaning (headings may be worded differently from the syllabus). It never rewrites the text. **Match by headings** (no AI) uses headings that match topic titles; sub-headings stay with their topic, and a paragraph that starts with a topic's title counts as its heading (PDFs often lose heading styles). Parts about nothing in the syllabus (a preface, an index) are left out.
3. **Check where each part goes:** each part shows its heading or first words, its size, **Read it**, and the topic it is filed under, which the student can change. The screen says how many topics are covered and which are not yet.
4. **Save to my topics:** each topic gets the student's notes, shown on the topic page under **Your notes** (alone when the topic has no staff content, otherwise below it). Quick checks and quizzes on the topic also ask about them.

**Scanned PDFs** (pages that are only pictures) are read with text recognition (Tesseract) on the server, in both this screen and Build a course. The file appears at once with "Reading scanned pages… 3 of 40" and the screen updates by itself; matching or slicing waits until it is done, and the student can leave and come back. Pages that already have text keep it; only picture pages are recognised. Printed pages read well; handwriting does not. A blank PDF (no text and no pictures) is refused. If the server restarts while a file is being read, it shows "Reading stopped…" and the student adds it again. Setup: `sudo apt install tesseract-ocr` (and `tesseract-ocr-tam`, `-hin`… for other languages, with `OCR_LANGS=eng+tam` in `.env`); `OCR_WORKERS` (default 1) files are read at a time, `OCR_MAX_PAGES` (default 300) pages per file, a few seconds a page. Without Tesseract, scanned PDFs are refused with a clear message and everything else works.

A topic with no notes of its own (a framework topic) shows students **This topic has no notes yet** with **Bring your own notes**, and no gist: the AI is never asked about a topic from its name alone (the server refuses with that message). Once a student's notes are filed under it, Explain and the sample answer use them.

The notes are private: classmates, faculty and admins don't see them. Saving again rebuilds the notes from the material; **Remove my material** deletes the material and its notes. Reading, completion and quiz results are never touched. Only published, non-archived topics are offered, and only students who can open the course can add material. Matching with AI counts as one request toward the daily AI limit. Tables `course_materials` and `topic_notes` are created on first start. API under `/api/courses/{id}/my-material`.

## Students build their own courses
Students have **Build a course** in the menu. It turns their own notes, textbook chapters or handouts into a course they study in the app, next to the courses staff set up.

1. **Name** the course.
2. **Material:** upload PDFs (with selectable text; scanned pages can't be read), Word (.docx) files, or .txt/.md files, and/or paste text. Several files are joined in the order they are added. Word headings, lists and tables are kept.
3. **Slice:** the AI groups the material into units and the smallest topics that make sense on their own. The student can write notes for it ("one topic per verse", "keep the vocabulary table together"). The AI only decides where each topic starts and ends and what to call it: topics keep the student's own words, nothing is rewritten or invented. Without AI, **Slice by headings** uses the document's headings. Material longer than one AI request takes (about 110,000 characters) is sliced part by part in the background, cut between paragraphs and at a chapter heading where one falls near the end of a part; the outlines are joined in order and a unit that runs on into the next part stays one unit. The page shows how many parts are done. It counts as one AI request. If a part fails, the student is told once, with the suggestion to try again or slice by headings, and the request is given back.
4. **Preview:** every unit and topic with its size and the start of its text, **Read it all**, rename, **Merge with next** and **Remove**. Change the notes and slice again as often as needed; **Save outline and finish later** keeps the work.
5. **Finish** builds the course. **Change the setup** goes back to the outline later; finishing again replaces the topics (after asking), with their progress and quiz results.

Studying a course: topics in order with **Mark as completed**, previous/next, and an AI **Explain** (saved, so it is asked once per topic). On any topic, **Quick check** gives 5 AI-written questions with the answer and explanation right after each one; **Full quiz** gives 10 questions scored at the end (pass mark 60%), with what the student knows well and what to revisit. Every request writes new questions, asked to differ from the last ones, and the AI is told to use only facts in the material. The course page shows topics completed, the quiz average and each topic's best quiz score sorted into strong, getting there and revisit.

**Keeping a self-learner going** (simple, measurable, fun):
- **One next step.** Home and Build a course show a card with the day streak, level and points, this week's study days, **Review N topics due** and **Continue: <next topic>**. Students who have not built a course yet get a "Build a course from your own notes" shortcut on Home.
- **Stars and mastery.** Every topic has up to three stars: ★ completed, ★★ passed a full quiz (60%+), ★★★ mastered (90%+ in a full quiz). The course shows its mastery % (stars earned out of all possible).
- **No bookkeeping.** A quick check with 4 of 5 right, or a passed quiz, marks the topic completed.
- **Spaced review.** After every check a topic is scheduled to come back: 1, 3, 7, 14 then 30 days as results stay good (80%+), tomorrow again when they are poor (under 60%). **Review** mixes the student's own earlier questions on the due topics (two per topic, up to ten), with the answer after each one, and moves each topic on its own schedule. Reviews use no AI requests.
- **Points and levels.** 10 per topic completed, 1 per right answer, 20 per topic with a passed quiz, 30 more per mastered topic, 5 per review. Level 2 starts at 100 points, level 3 at 300, then 600, 1000 and so on. Points are worked out from what the student did, so they can't drift. After a check the student sees the points gained, new stars, "Topic completed", "Mastered!" or a new level, and when the topic comes back for review.
- **Streak.** Opening topics and taking checks in these courses count toward the day streak on Home, like the staff-made courses.

**Smaller things that keep a student unstuck:**
- **Checks on every topic.** Topics in staff-made courses also have **Quick check · 5** and **Full quiz · 10**, written by the AI from the topic's notes on demand.
- **Fix a topic later.** The owner of a course can edit a topic's title and text, or delete it, from the topic page without redoing the setup. Progress and stars stay.
- **Explanations fit the material.** Explain in student-built courses uses its own tutor prompt for any subject, written in the material's language.
- **Knowing what AI is left.** When 10 or fewer of the day's AI requests are left, topic pages say how many. Without an AI key, the AI buttons are off with the reason, and the wizard suggests slicing by headings.
- **Flow.** After a check, **Next topic** goes straight on. Courses with more than 12 topics have a **Find a topic** box. **This question is wrong** on any answered question keeps it out of future reviews.

Sharing: a course is private. Its owner can share it with **My classmates** (students in the same program); they can study it and take their own quizzes, but only the owner can change it. Admins can open and delete any of them through the API.

AI use follows the usual rules: self-registered students use their own DeepSeek key; others use the admin's key and are limited to `STUDY_AI_DAILY` (default 40) AI requests a day for their own courses. Limits: 50 courses per student, 20 MB per file, 1.5 million characters of material per course. API under `/api/study/...`; the tables are created on first start.

## Topics from an HTML file and a config file
In the topic editor (Add topic, or Edit topic), **Fill from files** takes an HTML file for the content and a config `.md` file for everything else. Choose them together, with any images the HTML uses, and the form fills in. Check it, then save. Nothing is saved until you do.

The config file (**Config template** downloads an example):

```
---
title: 1. Introduction and learning objectives
published: no
deadline: 2026-10-20 17:00
---

## Question pattern
...

## Sample content
...

## How an answer should be
...
```

- Everything is optional. The front matter sets the title, published (yes/no) and the learning deadline (`2026-10-20` or `2026-10-20 17:00`). The `##` sections fill the boxes of the same name; `Answer guideline` and `Sample answer` work too. Other headings stay inside the section they are in, so a sample answer can have its own headings. A `## Topic content` section is used as Markdown content when there is no HTML file.
- Without a title in the config, the HTML file's `<title>` or first heading is used.
- The HTML keeps its structure (headings, lists, tables, links, images, right-to-left text) and takes the app's look in light and dark mode. Scripts, styles, forms, frames and event handlers are removed on the server when it is saved and again whenever it is shown, so an uploaded file can't run code. The editor's preview is cleaned the same way.
- Images embedded in the HTML (`data:` images) are saved as uploads. Images referenced by file name (`<img src="figs/chart.png">`) use the image file of that name chosen with the HTML; any others are left out and named.
- The content box has a **Markdown / HTML** switch, so an HTML topic can still be edited by hand; **Add image** inserts an `<img>` in HTML mode. Version history, restore and copying keep the format. A CSV import always writes Markdown content. Search and the AI read the text of an HTML topic, not its tags.
- API: `POST /api/topics/from-files` (`unit_id`, `html`, `config`, `images` as file name → upload url) returns the filled fields; topics take `content_format` (`markdown` or `html`). Migration 0019 adds `content_format` and, on MariaDB/MySQL, makes topic content MEDIUMTEXT.

## MCQ tests (whole course, from a CSV)
A course test is a multiple-choice test for a whole course rather than one unit. The course owner or an admin opens the course and taps **New MCQ test from a CSV**.

1. **Attach the CSV.** One question per row. Columns: `question`, `a` to `f` (the answer choices; leave the later ones blank if there are fewer), `correct` (the letter, the number or the exact answer text), and optionally `explanation`, `topic` (a topic title from the course), `area` (a skill name for questions not tied to a topic), `question_image` and `a_image` to `f_image` (image file names). **Download the template** shows the format. Comma, semicolon and tab files all work, up to 200 questions. Rows that can't be read are listed with the reason and left out; a topic name that isn't in the course becomes an area.
2. **Preview, add images, save.** Every question can be checked and edited. Questions and answer choices named in the image columns show "Needs boiler.png": **Upload images** takes all the files at once and matches them by file name, or upload each one in place (Skip drops it). Any question or answer can get an image here even if the CSV didn't name one, and an answer can be just an image. **Create test** stays disabled until every named image is uploaded or skipped. Tick **Published** when students may take it, and **Show students the correct answers and explanations after they submit** if they should see the key.

Students find the test on the course page under **MCQ tests**, and on Today when they haven't taken it or haven't passed yet. After submitting they see the score, a sentence on what they are good at and what to revisit, the areas grouped as Needs another round / Getting there / Strong (by topic, else by area), and **Review answers**, a question-by-question view of their answer and, when the test reveals it, the correct one.

**Scores and drill-down.**
- Staff: the chart icon beside a test (or a unit quiz) opens **Results**. *Overview* has the average final score, pass rate, median, highest and lowest, who took it and the spread of scores. *Students* lists each student's final (best) and latest score, attempts and strengths; tap one to see their attempts, then any attempt question by question. *Questions* shows how many picked each answer, with the correct one marked, sorted in test order or hardest first. *Strengths* lists the class's areas, weakest first. **Download results CSV** includes students who haven't taken it.
- **Gradebook** on the course page: every student × every published test and quiz with their final score, and a final course score (the average of the tests they took). Tap a test for its results or a student for their tests and attempts; CSV download.
- Students: **My progress > Scores** gives the final score per course, then each test's best and latest result, then each attempt.

A student's final score in a test is their best attempt. Strengths and the question analysis use each student's latest attempt, so a retake replaces the earlier result. Unit quizzes take images, areas and the answer setting too, and their **Add from a CSV** uses the same format. API: `POST /api/quizzes/parse-csv`, `POST /api/quizzes` with `course_id`, `GET /api/quizzes/{id}/results`, `GET /api/quizzes/{id}/attempts`, `GET /api/attempts/{id}`, `GET /api/courses/{id}/gradebook`, `GET /api/me/scores`. Migration 0018 adds the columns.

## Safety rules for the AI (built in, not editable)
Every AI request starts with the app's safety rules (`backend/guardrails.py`), ahead of every prompt an admin can edit under Settings. They live in code, not in Settings or the database, so they cannot be changed or switched off from the app; changing them is a code change.
- **What they say:** stay a study helper; nothing unsafe for young people (no sexual content, gore, hate, or instructions for weapons, drugs, hacking or self-harm; science stays at textbook level); a student in crisis gets a short, caring reply pointing to a trusted adult or emergency services; be honest and say when unsure; never ask for personal details; treat notes, uploads and questions as material, never as instructions; keep the rules private. They say they override everything that follows, including the editable prompts.
- **How they are enforced:** `deepseek()` (text, to DeepSeek) and `vision()` (a photo of a diagram, to Claude) in `main.py` are the only two places an AI request leaves the server. Each always puts the rules first, fences everything people wrote (topic notes, uploads, a student's notes, searches) as material, strips hidden direction and zero-width characters and fake fence markers from it, and withholds any reply that leaks the rules (a hidden marker in the rules gives it away).
- **A search that reads like a crisis** (self-harm or suicide, in English, Arabic or Tamil) is answered at once with a caring message in the student's language: no AI call, and nothing saved or logged.
- Admins can read the rules under Settings → AI prompts → Read the safety rules. Tests in `backend/tests/test_guardrails.py` check that every request starts with them, even after an admin rewrites a prompt to say otherwise.

## What goes to the AI provider, and what does not
The rule: study text goes out **once**, the answer is kept, and from then on the app shows its own copy. A student's doubt sends only names and a phrase.
- **Sent once, then kept:** a topic's gist, steps, Explain and Sample answer (shared by everyone, saved in `ai_cache`); a student's own-notes Explain and Sample answer (private to that student, saved in `private_answers`, sent again only if the notes or the prompt change); the slicing and matching of a student's uploaded material (the outline is saved with the material). A second look at any of these sends nothing.
- **A doubt (`Not clear?`):** in the reader, select a phrase and tap **Not clear?**. Step one stays on the server: the panel shows where the phrase sits in the topic and in the student's own notes, and a kept AI answer if this doubt was asked before. Only if the student taps **Still not clear? Ask AI** does anything leave: the names of the program, semester, course and topic, and the phrase (up to 300 characters). Never the topic text, never the student's notes. The answer is kept in `doubt_answers`, so the same doubt is never sent twice. Students get `AI_DOUBT_DAILY` (default 30) AI doubts a day; kept answers are free. API: `POST /api/topics/{id}/doubt` (local) and `POST /api/topics/{id}/doubt/ask` (AI). The prompt can be edited under Settings > AI prompts like the others.
- **A highlight's explanation** (written when a student highlights a passage) sends, like a doubt, only the program, semester, course and topic names and the highlighted passage (up to 600 characters), never the notes. It is kept per passage and language and shared, so the same words are never sent twice.
- **Search** sends the typed search and the student's program and semester only; answers are kept and shared.
- **Ask from a photo** reads the photo's text on this server; only that text (checked by the student), their question and their program and semester go to DeepSeek. The photo itself leaves only when the student says the question is about a diagram, and then only to Claude. Photos are shrunk in the phone, re-encoded on the server (no location or camera details) and never stored; answers are not kept.
- **Still sent each time:** a new Quick check or Full quiz in a student-built course sends that topic's text again, because every request is meant to write different questions. Reducing that means generating a question bank once and drawing from it, which is not built yet.
- **The outbound log:** every request that leaves is recorded in `ai_egress`: who, which kind, which topic, how many characters, and whether it was answered. Never the text. Admins read the totals at `GET /api/admin/egress?days=30`.

## Android app (mobile/)
A native Android app for students (Android 13 and later) lives in `mobile/`; see `mobile/README.md`. GitHub Actions builds it and publishes each new version as a release; the server checks for the newest once a day and the home page offers it for download with its version and date. Releases need a signing key in the repository's secrets (one-time setup in `mobile/README.md`).

## The home page and where the app lives
The site's root (`/`) is the Zigora home page, a single static page in `web/` (`index.html`, `site.js`, fonts and the logo; no build step). It is in English, Arabic (right to left) and Tamil, and its buttons open the app, which now lives under **`/app/`**.
- Edit the page's words in `web/index.html` (English) and `web/site.js` (Arabic and Tamil). It is served under the app's strict security policy, so it uses no outside fonts or scripts; keep it that way.
- The app is built with base `/app/` (`frontend/vite.config.js`); the installed-app manifest, offline worker, password reset links and digest emails all point there. An installed app opens straight into `/app/`, and the home page removes the old offline worker the app used to register at the root.
- `APP_URL` in `.env` stays the site's root (for example `https://learn.example.edu`); links add `/app/` themselves. Old bookmarks to the root now land on the home page, one tap from the app.
- Without a `web/` folder, the root simply redirects to `/app/`.

## Notes in my language
A student whose app is in Arabic or Tamil sees **Original | العربية/தமிழ்** above a topic's notes. The first time anyone asks, the notes are translated in parts (about 3000 characters each, three at a time) with the editable "Notes in my language" prompt: the format is kept (Markdown, or HTML tags unchanged and cleaned afterwards like any upload), formulas, symbols, units and numbers stay as they are, and a technical term gets its English name in brackets the first time. The translation is kept per topic and language and shared, so each costs tokens once; editing the notes or the prompt starts afresh. Highlighting works on the original, so the full-screen reader always opens the original. Interactive pages are not translated.

## Monthly AI allowance
Under **Settings → AI → Monthly AI allowance**, set how many tokens the college's keys may use each month, separately for DeepSeek and Claude (0 = no limit), and see how much is used. Every request on the college's keys records the tokens the provider billed (`ai_egress.tokens`); requests paid with a student's own key are marked `own` and don't count. Admins see a warning on Home at 80%. When an allowance is used up, new AI answers stop until the 1st of the next month with a plain message; saved answers keep working. `GET /api/admin/budget` gives the numbers.

## Rewards for answers others reuse
There is nothing to share by hand: saved AI answers are already shared. A student's **search**, **Not clear?** doubt or **highlight** that brings a new AI answer makes them its author (stored as `author_id`, never shown to anyone else). Each time someone else is shown that saved answer, one use is counted, at most once per person, per answer, per day (`share_uses`), so refreshing cannot inflate it. Every 1000 uses by others earn 100 points (`SHARE_USES`, `SHARE_POINTS` in `main.py`), however they add up: 1000 answers used once, one answer used 1000 times, or 500 answers used twice. The student's own views never count, staff are not rewarded, and topic gists (written for whoever opens a topic first) don't count.
- Students see their points, uses and progress toward the next 100, and which of their answers others use most, on **My profile** (tap your name in the header). What points can be spent on is to be decided; spending will live in the profile too.

## Ask from a photo
The camera beside the search box opens **Ask from a photo**: a student photographs a question, a paragraph or a diagram in their book (or picks a photo), checks the text the server read from it, and asks (quick choices: Explain this simply, Solve it step by step, What will the exam ask about this?; with a diagram: What does the diagram show?). Answers come back short, with "This looks wrong?" under each.
- **The camera opens inside the page** (a live view and a shutter), not in the phone's camera app: handing over to the camera app made Android close the browser tab for memory and lose the page. The server allows the camera for its own pages only (`Permissions-Policy: camera=(self)`). If the camera can't be opened or permission is refused, the page says so and offers the gallery.
- **Text:** read on this server with Tesseract, in the languages in `OCR_LANGS` (for English, Tamil and Arabic: `OCR_LANGS=eng+tam+ara`, with the `tesseract-ocr-tam` and `tesseract-ocr-ara` packs installed). Only the text goes to DeepSeek.
- **Diagrams (optional):** the text providers here are not sent images. Add a Claude API key under **Settings → AI → Photos of diagrams (Claude)** (or `ANTHROPIC_API_KEY` in `.env`), and use **Test the key**. Then a student can tick "My question is about a diagram" and the photo goes to Claude (default model `claude-opus-5-5`, changeable there; refused requests are retried on a fallback model by the API). A photo question to Claude costs roughly 1 to 2 US cents. Without a key, diagrams are read for their labels only. People who registered themselves never use the college's Claude key.
- Students get `AI_PHOTO_DAILY` (default 20) photo questions a day. The editable prompt is "Ask from a photo" under Settings → AI prompts; the safety rules come first as everywhere.
- After updating, run `pip install -r backend/requirements.txt` once (it adds the `anthropic` package).

## How students learn a topic: short, curious, their choice
The notes are the reference; the learning happens in small steps the student picks, and the app never assigns work.
- **The gist** heads every topic page: three short points and one curious question (the answer is one tap away). Then four steps, each a few lines that end in a question worth wondering about: **Why?**, **Example**, **Exam angle** (an exam-style question with a short model answer and what examiners look for) and **Quick check** (one question, answer on tap, nothing scored or reported). The full notes, Explain and the sample answer stay below.
- **Short by design:** the gist is about 50 words and each step at most about 80, with token limits on every reply. Explain is now at most 150 words. The Sample answer tab opens with the outline of a full-marks answer; the full answer is one tap away.
- **Remember this?** On Home, one question from a topic the student opened 2 to 60 days ago, taken from that topic's saved gist (no AI call). It changes daily and can be dismissed for the day.
- **No pressure:** Home shows where the student left off, Remember this? and their courses. There are no streaks, stat tiles, "today's focus" or late labels. A study routine appears only if the student sets one under My routine. A teacher's date shows as a plain date, and "I've learned this" is the student's own mark. Students are notified only of a teacher's date coming up and of new tests.
- **It adapts to each student, privately.** The steps a student opens most move to the front (after 3 taps). After a quick check's answer they can say "I had it" or "Not quite": mostly "Not quite" makes the next quick checks plainer, with a hint; mostly "I had it" makes them ask to apply the idea. "Not quite" also offers the idea again, more simply. After 3 topics opened in a unit, its other topics start with the question and keep the gist one tap away. Remember this? brings back topics whose last quick check was "Not quite". My progress shows the student what the app has picked up, with **Start fresh** to clear it. Teachers never see any of it, and staff are not profiled.
- **Quiet everywhere a student looks.** The student menu has four places: My courses, Saved (bookmarks and highlights), My progress and Build a course; About is in the footer. My progress shows "What clicked" and "Worth another look" without percentages, the optional study routine, test results folded away, and how the app adapts. Test results state the score and the pass mark without verdicts. Course and unit lists show how many topics there are and a tick on the ones the student marked as learned, with no completion bars. Courses students build have no streaks, points, levels or stars. Teachers' screens (gradebooks, pass marks, reports) are unchanged.
- **Highlight, then understand it.** When a student highlights a passage in the reader, a short card ("What this means", at most 60 words) explains it in plain words (the AI gets only the names and the passage). The explanation stays with the highlight (in the reader's list and in Saved), and tapping a highlight offers **Explain** too. It is saved per passage and language, so the same words cost tokens once; each student can ask for up to 40 new ones a day (`AI_LINE_DAILY`).
- **Revision sheet.** On a unit, **Revision sheet** puts every topic's gist, its question ("Ask yourself") and the student's own highlights on one page, with **Print or save as PDF** (two columns on paper). Missing gists are written as the sheet opens.
- **"This looks wrong?"** under every AI reply (gist, steps, Explain, sample answer and outline, highlight explanations, AI search). A student can add what looks wrong. The topic's teacher (admins for searches and everything) sees **Flagged AI answers** on their Home, never with the student's name, and chooses **Write it again** (the saved reply is dropped and the next request writes a new one) or **It's fine**.
- Every reply is saved per topic and language, so each costs AI tokens once. Admins can change any of these prompts under Settings → AI prompts.

## Lists: ten rows a page
Every list in the app shows at most ten rows; a longer one gets numbered pages under it (Previous, page numbers, Next, and "1–10 of 41"). Long lists from the server (users, courses, programs, the activity log, the Reports lists, the question bank) are fetched a page at a time; shorter ones the screen already holds use the `Paged` component in `frontend/src/App.jsx`. New screens follow the same rule: wrap a list in `<Paged rows={…} render={…}/>`, or use `usePaged` with `<Pager>` when the server pages it.

The **Activity log** can be searched by person or action and filtered by action (created, changed, deleted), result and time (last 24 hours, 7 or 30 days), newest or oldest first, and downloaded as CSV. On **Reports**, the most read topics, students and saved AI answers each have their own search, filter and sort; a course's student report can be searched and filtered (never opened a topic, under 50% completed, needs another round of study) and sorted by completion or last activity.

## Reports
**Reports** now shows, per course, how many students can see it, how many topics it has, the average share of topics read, and quiz averages (each student's best score per quiz). Filter by program and semester, tap a course to see every student's completion, topics read, quiz results and last activity, and download either list as CSV (names starting with `=`, `+`, `-` or `@` are escaped so spreadsheets can't run them). Admins see all courses; faculty get a Reports page limited to their assigned courses. "Read" means the student opened the topic (completion in Reports is still based on opening, not on "Mark as completed"); only published topics count.

## AI (one provider, one key for everyone)
Zigora works with **DeepSeek, ChatGPT (OpenAI), Claude (Anthropic), Qwen (Alibaba Cloud Model Studio, international endpoint) and Perplexity**. Under **Settings → AI** an admin picks the provider the college uses, saves its key and, if they like, a model (each has a sensible default: `deepseek-chat`, `gpt-4.1-mini`, `claude-opus-5-5`, `qwen-plus`, `sonar`). One provider answers at a time; keys saved for the others are kept, so switching back is one click, and answers already saved keep working after a switch. A key in `.env` is used when none is saved: `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DASHSCOPE_API_KEY` or `PERPLEXITY_API_KEY`. The Claude key also reads diagrams in photos. Perplexity answers from the web as well as the notes, so its answers can include outside material. Each provider has its own monthly allowance, and **Settings → AI costs** prices each at the rate you enter.

People who register themselves (and parents or teachers, for their school students) can save their own key for any of the five providers under **My AI key**; it is checked with that provider first, stored encrypted, and its usage is billed to them, not the college.

That single college key serves every student. With a key, the Explain and Sample answer buttons work, and each answer is saved and reused for all students. Without a key, or if the key is removed, students see "AI unavailable. Try again later." and the buttons are hidden, saved answers included, until a key is added again. If the provider errors, times out or rejects the key, students see the same message and can try again, while admins also get the likely cause. **Test the key** checks it with a tiny request, and **Remove the key** turns AI off for everyone. `GET /api/ai/status` tells the app whether AI is on.

## Email (password resets, registration codes, daily summaries)
Set it up in the app: **Settings > Email**. Enter a Gmail account for the college and a Google **App Password** for it (Google Account > Security > 2-Step Verification > App passwords: 16 letters; spaces are ignored), and the site's address for links (for example `https://learn.yourcollege.edu`). **Send a test email to me** checks it.
- The App Password is stored sealed with the server's key and never shown again. The screen shows how sending is going (last success, failures in a row with the reason, such as Gmail refusing the sign-in) and a list of emails sent: who and when, kept 90 days, never the text, because emails carry reset links and codes.
- Emails are plain text with a simple HTML copy whose link is a button. They come from the institution's name (Settings > Institution) at the Gmail address.
- Servers set up earlier keep working from `.env` (`SMTP_HOST`, `SMTP_FROM`, `APP_URL`, plus `SMTP_PORT`, `SMTP_TLS`, `SMTP_USER`, `SMTP_PASSWORD`); a Gmail account saved in the app takes over from them, and removing it goes back to them. The site address saved in the app likewise takes over from `APP_URL`.

With email on, the sign-in page shows **Forgot password?**: the person enters their email and gets a link that works once, for 30 minutes (`RESET_MINUTES`). Choosing a new password signs them in, ends every older session and link, and lifts any sign-in lockout. Details that matter:
- The answer is the same whether or not the email has an account, so the form can't be used to find out who is registered, and disabled accounts get no mail. A failed send is recorded for the admin; the person sees the same answer.
- Links always use the saved site address (or `APP_URL`), never the request's Host header, so a forged header can't redirect a reset link. The token sits after `#` so it never reaches server logs, and only a hash of it is stored.
- Limits: 3 emails an hour per account and 20 requests an hour per address.
- Without email the sign-in page says "Ask your admin to reset it", and the admin Reset button still works.

## Self-registration

Off by default. Turn it on under Settings > Self-registration. It also needs email set up (Settings > Email, see the email section); without that it stays closed.

- The sign-in page shows "Create an account". People give full name, institution, ID number, email, phone and a password.
- A 6-digit code is emailed (valid 10 minutes, 5 tries, resend after 30 seconds, at most 8 codes per email). **No account exists until the code is verified.** Then they are signed in as students.
- The code email is sent while the person waits, and tried once more if it fails. If it still fails, the screen says the code could not be sent (never that it was), with **Try sending the code again** (no 30-second wait after a failure) and **Back to sign in**. The reason stays in the email log for the admin. An address that already has an account gets the same answer, delivery failure included, so the form still can't be used to find out who is registered.
- The sign-up form gives the same answer whether or not an email already has an account (an existing address gets a notice by email), and an institution + ID number can only be used once.
- Optional "only these email domains" (for example `college.edu`) limits who can register.
- They arrive with no program or semester. Until they are placed, Home (and My courses in the app) says the admin will assign their program and term, and that they don't have to wait: **Build a course from your own notes** and **Join a course offered by a teacher** are right there. Find them in Users (marked "Self-registered"; search by name, email, ID or phone), then use Select several > Move.
- **AI uses their own key.** Self-registered people never use the shared admin key. They add a DeepSeek key under "My AI key"; it is checked with DeepSeek, then stored encrypted (derived from `JWT_SECRET`, so changing that secret means they add their key again). Until they do, AI shows as off for them.

### AI plans for self-registered people
- **Lite** (everyone who registers themselves): your DeepSeek key, within a free daily allowance set under Settings > Sign-in (default 10 AI searches and 20 minutes of learning with AI a day, by the students' local day). A search is a question to the AI (search, a photo question or "Not clear?"); the rest (topic steps, explanations, sample answers, translations, highlight explanations, own courses) is learning time. Time counts each minute once: the app ticks once a minute while a topic or own-course screen is open and on screen, and every new AI answer counts its minute too. Saved answers never count. When the allowance is used up, the message offers the two ways to more.
- **Own key**: they save their own DeepSeek key under My AI key; no allowance applies and their usage is billed to them.
- **Pro**: an admin opens the person under Users (filter "Asked for more AI", or the Home page's attention item) and makes them Pro for 7, 30, 90 or 365 days or until a date. They then use the college's key like a college student (photos of diagrams included) until the end of that day, and get an email about it when email is on. **End Pro now** takes them back to Lite.
- Lite people ask for more from My profile (web) or Me (Android), with an optional note; one open request at a time.

## Shared question bank

A pool of questions every faculty member and admin can browse, so a good question is written once and reused across courses.

- In a quiz, **Save to bank** shares its questions (optionally with tags such as `water, hardness`; the quiz and course name are kept as the source). Exact duplicates are skipped.
- **Add from the question bank** searches by words, tag or source ("Only mine" narrows it), then adds the ticked questions to the quiz you are editing. Review them, tie them to topics, then save.
- Adding **copies** the question, so editing or deleting it in the bank never changes a quiz students are already taking.
- Everyone on staff sees every bank question. Only the person who added a question, or an admin, can edit or delete it. Students never see the bank.
- API: `GET/POST /api/bank`, `PUT/DELETE /api/bank/{id}`, `POST /api/bank/from-quiz/{quiz_id}`, `POST /api/quizzes/{quiz_id}/questions/from-bank`.

## Semester, year or grade programs

Each program is a **semester** program (B.E., B.Tech, M.E.), an **annual** program (M.B.B.S, B.Sc, law) or a **school** program (Grade 1 to 12). Choose it when you create the program under Programs > New program.

- The terms are created for you: Semester 1 to 8 (default for semester programs), Year 1 to 4 (default for annual programs) or Grade 1 to 12 (default for school programs). Semester and annual programs take 0 to 8, so M.B.B.S can start with 5 years; school programs take 0 to 12. You can go straight to adding courses.
- Everything then speaks the program's own word: the program page, adding a term, Users (placing a student, bulk Move, a student's "Year 2" or "Grade 7"), and starting a new term ("moves up one year"). The number dropdowns go up to 12 for school programs.
- Edit a program to change its pattern. Terms still named "Semester n", "Year n" or "Grade n" are renamed to match; terms you named yourself keep their names. A school program with grades above 8 cannot become a semester or annual program until those grades are deleted or renumbered.
- Existing programs stay semester programs. The CSV import creates an annual program when its terms are called "Year 1", "Year 2" and so on, and a school program when they are called "Grade 1" (or "Std 1", "Class 1"; Roman numerals such as "Grade XII" work too). Students' semester, year or grade is a number from 1 to 12, and a student sees every term up to their current one.

## Search (local first, then AI)

Students find topics from **Search** in the menu, or the search bar on Home.

- As they type, topics in their own program (up to their current semester or year, published only) are listed. Press Enter to search properly.
- If the app has a good match (the words appear in a topic title, unit or course name) it shows those topics. If there is no match, or only a weak one (a word buried in some notes), the **AI answers automatically** and any weak matches stay listed above it.
- **Recheck with AI** is on every result: after local results it asks the AI; after an AI answer it asks again from a different angle (a recheck is not saved for others).
- AI answers to a search are saved and shared, so the same question costs tokens once. Each student gets 30 AI searches a day (`AI_SEARCH_DAILY` in `.env`); saved answers don't count. Self-registered users use their own key, as everywhere.

## Editing the AI prompts

Settings > AI prompts lets an admin rewrite the instructions the AI gets for **Explain**, **Sample answer** and **Student search**: tone, language, depth, format. Saving discards the saved answers that the old wording produced, so the new prompt applies from the next question (that spends tokens again). "Reset to built-in" restores the original. Prompts are 20 to 4000 characters.

## Own-pace routine
Students pick **My routine** in the menu: their study days (Mon to Sun), minutes a session (15, 30, 45 or 60) and, optionally, their usual time. Home then shows **Today's session**:

- **One small session a study day:** 1 new topic (15 or 30 minutes), 2 (45) or 3 (60), plus one review set when reviews are due. The topic they already started comes first, then topics with deadlines (nearest first), then each course's next topic in turn, so no course is left behind. Staff courses and their own courses are both included.
- **Fixed for the day:** finishing a topic ticks it off; it doesn't add another. When every item is done the card says **Done for today** and when the next session is. Changing the routine redoes today's session only if nothing in it was done yet.
- **No pile-up:** after missed days, today is still one session, with "Welcome back… no catching up needed". The plan is worked out again each day from what is left: how many topics remain, when they'd be finished at this pace, how many would miss their deadline, and one suggestion (add a study day, or study longer) when that helps.
- **Rest days:** no session is made; **Study anyway** makes one. With a routine, the streak counts only the chosen days: a rest day doesn't break it, studying on one still counts. Without a routine nothing changes.
- **In the app only:** no messages are sent.

**Stop the routine** removes it and its daily sessions; progress is untouched. Tables `routines` and `day_sessions` are created on first start. API: `GET`/`POST /api/me/session`, `PUT /api/me/routine`, `POST /api/me/routine/stop`.

## Student dashboard

Home for a student is a plan for the day, not a list of everything.

- **Today's focus:** up to four next steps, most urgent first: overdue topics, topics due within three days, topics tied to weak quiz results, the topic they started, quizzes to retake (below the pass mark) or try, and the next topic in each course. A topic appears once, with the reason in plain words ("Overdue by 2 days", "You scored 40% on questions about this").
- **Study streak and week:** consecutive days with any study (opening a topic, completing one or taking a quiz), and a 7-day strip. A day not yet studied does not break a live streak. Days follow the college's time zone: set `DAY_OFFSET_MINUTES` in `.env` (default 330 for India; 0 for UTC).
- **Tiles:** streak, topics completed this week, overall completion, quiz average (best score per quiz).
- **Courses:** progress, overdue count and the next topic to open.

## After an update: rebuild the screens

The built screens (`frontend/dist`) are not stored in git. After `git pull`, run `./run.sh` (it rebuilds and restarts). If you only restart the backend, the app serves the old screens and new features seem to be missing (for example the new student dashboard, or a program getting 8 semesters instead of the years you chose). To check, open `/api/version` on your server: `"match": true` means the screens are up to date; `false` shows what to run.

## Strengths and weak areas
Authors tie each quiz question to the topic it tests (the "Topic this tests" menu in the quiz editor; untied questions count under their unit). From each student's **latest** result in each published quiz the app works out, per topic, what share they got right: **80% or more is a strength**, **below 60% needs another round of study**, and in between is "getting there" (`STRONG` and `WEAK` in `backend/main.py`). A retake replaces the earlier result, so improving moves a topic up.
- **After a quiz** the student sees "How you did by topic" with the weakest first and a **Study again** button that opens the topic. They still don't get the answer key.
- **My progress** (students' drawer) lists strengths and the topics that need another round of study across all their courses, with whether they have opened or completed each topic.
- **Staff** see, in Reports > a course, the topics the class finds hardest (with how many students need another round) and, under each student, their strong and weak topics; the students CSV gains "Strong areas" and "Needs another round of study" columns. Faculty see only their own courses.
- A draft topic is never named to students (its questions count under the unit), and attempts made before this feature have no per-question detail, so they are ignored until the student retakes the quiz.

## Look and branding
- The app follows the device's light or dark setting. Each person can force Light or Dark (or go back to Auto) with the switch at the bottom of the menu; the choice is remembered in that browser.
- Admins set the institution's name and logo under Settings. The logo is a PNG, JPG or WebP uploaded there (under 3 MB, square works best). It appears on the sign-in page and in the menu; without one, a neutral mark is shown. Clearing the name goes back to `APP_NAME` in `.env`.
- Fonts are bundled with the app, so nothing is loaded from the internet.

## Staff workflow
- **Home** for admins and faculty lists what needs attention (courses with no owner, students not placed in a program and semester, draft topics, semesters without a number, students who have never opened a topic) and the course table with completion. Faculty see only their own courses.
- **Dashboard cards open their list**: tap any number (Active students, Studied this week, Faculty, Courses, Topics, Drafts) or any "Needs attention" item to see the rows behind it. The list has search, sorting and 5 rows per page; tap a row to open that user, course, topic or program.
- **Start a new term**: Programs > a program > "Start a new term". It previews, then moves every active student up one semester. Students already in the program's last semester are left alone or have their accounts switched off, as you choose. Run it once per term.
- **Quizzes from a CSV**: in the quiz editor, "Import from CSV" adds questions from a file with the columns `question, a, b, c, d, correct, explanation, topic` (`correct` is a letter or number; `topic` is matched to a topic title in the unit). Problem rows are listed and skipped; nothing is saved until you press Save quiz. "CSV template" downloads an example.
- **Preview as student**: on a topic page, staff can hide the editing buttons to see what students see.
- **Bulk actions in Users**: "Select several users", tick people (or "Select all shown"), then Move (program and semester), Disable, Enable or Reset passwords. Your own account and anyone an action can't apply to are skipped and listed. Reset passwords gives a one-time download of the new passwords; each person must choose their own at next sign-in.
- **Topic version history**: every save of a topic's text (editor, CSV re-import, restore) is kept, up to the latest 100 per topic. On a topic page, staff who can edit the course open "Version history", compare any version with the current text (red = only in the old version, green = in the current text) and restore it. Restoring adds a new version, so nothing is lost. A topic that predates this feature keeps its old text as a baseline the first time it is edited. Students never see history.
- **Copy topics and units between courses**: on a topic page, "Copy to another course" copies that topic into a unit you choose; inside a unit, "Copy this unit to another course" copies the unit with all its topics and, if you may edit the original, its quizzes (with each question still tied to the right copied topic). You can copy into any course you can edit; admins can copy anywhere. Copies are always drafts, names stay unique ("Water (copy)"), the original is untouched, and reading progress, bookmarks, deadlines and saved AI answers are not copied. Someone else's draft topics are never copied.

## Front-end conventions
The UI is `frontend/src/App.jsx` (the shell, shared pieces and the student pages) plus page groups in `frontend/src/pages/` (admin, teach, edit, study, plan, mcq, family), each loaded the first time one of its pages opens, and one stylesheet. A page group imports the shared pieces from `App.jsx`; `App.jsx` names each group's pages with `lazy()` and shows a skeleton while one loads. React, the Markdown and maths libraries and the icons build into their own files too (`vite.config.js`), so no file passes Vite's 500 kB warning and the libraries stay cached when only the app changes. Put a new page for staff in a group, not in `App.jsx`. So that every screen behaves the same, reuse these pieces instead of writing a new variant:
- **Confirmations:** `const confirm=useConfirm()`, then `if(!await confirm({title,body,ok,danger}))return`. Don't use the browser's `confirm()`.
- **Sheets:** `<Sheet close={...}>` for every bottom sheet (Escape closes the top one; focus moves in and back out). Back out with **Cancel**; use **Close** or **Done** only on sheets that just show something.
- **Shared parts:** `<Skeleton/>` for loading (not "Loading…" text), `<Toast/>` via `toast(msg)`, `<ShowMore left={n} onClick={...}/>` for long lists, `<Tabs/>` for tab bars.
- **Spacing and badges:** section headings are `<h3 className="sec">` (`sec first` at the top of a page); status badges are `pill sm`; the button that opens a list is `btn ghost lead`; a row's action buttons go in `<div className="acts">` so they wrap under the title on a phone.
- **Tappable rows** are buttons (`row rowbtn`) with a chevron, never a clickable `div`. Colours come from the theme variables (`--ok`, `--warn`, `--bad`, `--info`, `--acc`) and corner radii from `--r-ctl`, `--r-box` and `--r-sheet`.
