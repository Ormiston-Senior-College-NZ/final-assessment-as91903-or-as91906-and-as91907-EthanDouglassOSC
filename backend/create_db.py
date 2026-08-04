import sqlite3
import os

DATABASE = os.path.join(os.path.dirname(__file__), "studentnet.db")

# Delete old database
if os.path.exists(DATABASE):
    os.remove(DATABASE)

connection = sqlite3.connect(DATABASE)
cursor = connection.cursor()

cursor.execute("PRAGMA foreign_keys = ON;")
# ==========================================================
# USERS
# ==========================================================

cursor.execute("""
CREATE TABLE users (

    student_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,

    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,

    year_level INTEGER,
    kainga TEXT,

    setup_complete INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0

)
""")

# ==========================================================
# COURSES
# ==========================================================

cursor.execute("""
CREATE TABLE courses (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    code TEXT UNIQUE,
    name TEXT,
    level INTEGER,
    category TEXT

)
""")

# ==========================================================
# TEACHERS
# ==========================================================

cursor.execute("""
CREATE TABLE teachers (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    role TEXT NOT NULL,

    email TEXT,

    kainga TEXT

)
""")

# ==========================================================
# ROOMS
# ==========================================================

cursor.execute("""
CREATE TABLE rooms (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    code TEXT UNIQUE NOT NULL,

    name TEXT NOT NULL

)
""")

# ==========================================================
# TIMETABLE SLOTS
# ==========================================================

cursor.execute("""
CREATE TABLE timetable_slots (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    day INTEGER,
    session INTEGER,

    start_time TEXT,
    end_time TEXT

)
""")

# ==========================================================
# COURSE SCHEDULE
# ==========================================================

cursor.execute("""
CREATE TABLE course_schedule (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    course_id INTEGER,

    teacher_id INTEGER,

    room_id INTEGER,

    day INTEGER,

    session INTEGER,

    FOREIGN KEY(course_id) REFERENCES courses(id),
    FOREIGN KEY(teacher_id) REFERENCES teachers(id),
    FOREIGN KEY(room_id) REFERENCES rooms(id)

)
""")

# ==========================================================
# STUDENT LINES
# ==========================================================

cursor.execute("""
CREATE TABLE student_lines (

    student_id TEXT,

    line INTEGER,

    course_id INTEGER,

    PRIMARY KEY(student_id, line),

    FOREIGN KEY(student_id) REFERENCES users(student_id),
    FOREIGN KEY(course_id) REFERENCES courses(id)

)
""")

# ==========================================================
# SAMPLE USERS
# ==========================================================

users = [

    (
        "24244",
        "st24244@ormiston.school.nz",
        "test",
        "Ethan",
        "Douglass",
        13,
        "Papatūānuku",
        1,
        0
    ),

    (
        "admin",
        "admin@ormiston.school.nz",
        "admin",
        "Admin",
        "User",
        0,
        "",
        1,
        1
    )

]

cursor.executemany("""
INSERT INTO users (
    student_id,
    email,
    password,
    first_name,
    last_name,
    year_level,
    kainga,
    setup_complete,
    is_admin
)
VALUES (?,?,?,?,?,?,?,?,?)
""", users)

# ==========================================================
# COURSES
# ==========================================================

courses = [

    # =========================
    # YEAR 11
    # =========================

    ("ENG1","English",1,"English"),
    ("MAT1","Mathematics",1,"Mathematics"),
    ("ESL1","English as a Second Language",1,"English"),
    ("ELL1","English Language Learning",1,"English"),

    ("MAO1","Te Reo Māori",1,"Languages"),
    ("TIK1","Tikanga",1,"Languages"),

    ("SCI1","General Science",1,"Science"),
    ("BIO1","Biology",1,"Science"),
    ("CHE1","Chemistry",1,"Science"),
    ("PHY1","Physics",1,"Science"),

    ("PAS1","Pacific Studies",1,"Social Sciences"),
    ("GEO1","Geography",1,"Social Sciences"),
    ("ECO1","Economics",1,"Commerce"),

    ("PED1","Physical Education",1,"Health & PE"),
    ("OED1","Outdoor Education",1,"Health & PE"),
    ("HEA1","Health",1,"Health & PE"),

    ("CSC1","Computer Science",1,"Technology"),
    ("TEF1","Food Technology",1,"Technology"),
    ("PDT1","Product Design Technology",1,"Technology"),
    ("DVC1","Design Visual Communication",1,"Technology"),

    ("DAN1","Dance",1,"Arts"),
    ("DRA1","Drama",1,"Arts"),
    ("MUSL1","Contemporary Band",1,"Arts"),
    ("MUST1","Music Technology",1,"Arts"),
    ("MUSB1","Band Performance",1,"Arts"),
    ("DES1","Design",1,"Arts"),
    ("PAI1","Painting",1,"Arts"),
    ("PHO1","Photography",1,"Arts"),

    # =========================
    # YEAR 12
    # =========================

    ("ENG2","English",2,"English"),
    ("ENP2","English Projects",2,"English"),
    ("ESL2","English for Speakers of Other Languages",2,"English"),

    ("MAO2","Te Reo Māori",2,"Languages"),
    ("TAH2","Te Ao Haka",2,"Languages"),

    ("MED2","Media Studies",2,"English"),

    ("PED2","Physical Education",2,"Health & PE"),
    ("OED2","Outdoor Education",2,"Health & PE"),
    ("HEA2","Health",2,"Health & PE"),

    ("DAN2","Dance",2,"Arts"),
    ("DRA2","Drama",2,"Arts"),
    ("MUS2","Music",2,"Arts"),
    ("DES2","Design",2,"Arts"),
    ("PAI2","Painting",2,"Arts"),
    ("PHO2","Photography",2,"Arts"),

    ("MAT2","Mathematics",2,"Mathematics"),
    ("STA2","Statistics",2,"Mathematics"),

    ("PHY2","Physics",2,"Science"),
    ("CHE2","Chemistry",2,"Science"),
    ("BIO2","Biology",2,"Science"),
    ("SCI2","General Science",2,"Science"),

    ("PAS2","Pacific Studies",2,"Social Sciences"),
    ("GEO2","Geography",2,"Social Sciences"),
    ("HIS2","History",2,"Social Sciences"),

    ("ACC2","Accounting",2,"Commerce"),
    ("BUS2","Business",2,"Commerce"),
    ("ECO2","Economics",2,"Commerce"),
    ("FIN2","Financial Literacy",2,"Commerce"),
    ("TRM2","Tourism Studies",2,"Commerce"),

    ("CSC2","Computer Science",2,"Technology"),
    ("TEF2","Food Technology",2,"Technology"),
    ("PDT2","Product Design Technology",2,"Technology"),
    ("DVC2","Design Visual Communication",2,"Technology"),
    ("HOS2","Hospitality",2,"Technology"),
    ("COT2","Construction Technology",2,"Technology"),

    ("STAR2","STAR / Gateway",2,"Pathways"),

    # =========================
    # YEAR 13
    # =========================

    ("ENG3","English",3,"English"),
    ("ENP3","English Projects",3,"English"),

    ("MAO3","Te Reo Māori",3,"Languages"),
    ("TAH3","Te Ao Haka",3,"Languages"),

    ("MED3","Media Studies",3,"English"),

    ("PED3","Physical Education",3,"Health & PE"),
    ("OED3","Outdoor Education",3,"Health & PE"),
    ("HEA3","Health",3,"Health & PE"),

    ("DAN3","Dance",3,"Arts"),
    ("DRA3","Drama",3,"Arts"),
    ("MUS3","Music",3,"Arts"),
    ("DES3","Design",3,"Arts"),
    ("PAI3","Painting",3,"Arts"),
    ("PHO3","Photography",3,"Arts"),

    ("MAT3","Mathematics",3,"Mathematics"),
    ("STA3","Statistics",3,"Mathematics"),

    ("PHY3","Physics",3,"Science"),
    ("CHE3","Chemistry",3,"Science"),
    ("BIO3","Biology",3,"Science"),
    ("SCI3","General Science",3,"Science"),

    ("PAS3","Pacific Studies",3,"Social Sciences"),
    ("GEO3","Geography",3,"Social Sciences"),
    ("HIS3","History",3,"Social Sciences"),

    ("ACC3","Accounting",3,"Commerce"),
    ("BUS3","Business",3,"Commerce"),
    ("ECO3","Economics",3,"Commerce"),
    ("FIN3","Financial Literacy",3,"Commerce"),
    ("EFS3","Education for Sustainability",3,"Science"),

    ("CSC3","Computer Science",3,"Technology"),
    ("TEF3","Food Technology",3,"Technology"),
    ("PDT3","Product Design Technology",3,"Technology"),
    ("DVC3","Design Visual Communication",3,"Technology"),
    ("HOS3","Hospitality",3,"Technology"),

    ("STAR3","STAR / Gateway",3,"Pathways")

]

cursor.executemany("""
INSERT INTO courses
(code,name,level,category)
VALUES (?,?,?,?)
""", courses)

# ==========================================================
# TEACHERS NAMES
# ==========================================================

teachers = [

    # ==========================
    # Kea
    # ==========================

    ("Kate Lambert", "Deputy Principal", "", "Kea"),
    ("Jerrika Samuel", "Kāinga Leader", "", "Kea"),
    ("David Rooney", "Kāinga Leader", "", "Kea"),
    ("Cassandra Hill", "Kāinga Leader", "", "Kea"),
    ("Koriana Good", "Teacher", "", "Kea"),
    ("Kisa Leulua'i", "Teacher", "", "Kea"),
    ("George Mavunga", "Teacher", "", "Kea"),
    ("Daniel Paterson", "Teacher", "", "Kea"),
    ("Vasheeta Rai", "Teacher", "", "Kea"),
    ("Tara-Lee Soysa", "Teacher", "", "Kea"),
    ("Xiang Zhao", "Teacher", "", "Kea"),
    ("Brendan Booker", "Teacher", "", "Kea"),
    ("Jenny Koo", "Teacher", "", "Kea"),
    ("Kenneth Loh", "Teacher", "", "Kea"),
    ("Sunanda Lisboa", "Teacher", "", "Kea"),
    ("Nicolas Milnes", "Teacher", "", "Kea"),
    ("George Rao", "Teacher", "", "Kea"),
    ("Arti Singh", "Teacher", "", "Kea"),
    ("Yi Bao Ang", "Teacher", "", "Kea"),
    ("Praneel Chand", "Teacher", "", "Kea"),
    ("Henry Liu", "Teacher", "", "Kea"),
    ("Alan Roberts", "Teacher", "", "Kea"),
    ("Rebekah Swanepoel", "Teacher", "", "Kea"),
    ("Yuki Yang", "Teacher", "", "Kea"),
    
    

    # ==========================
    # Mokoroa
    # ==========================

    ("Pritika Chand", "Deputy Principal", "", "Mokoroa"),
    ("Nilam Chandra", "Kāinga Leader", "", "Mokoroa"),
    ("Joshua Thompson", "Kāinga Leader", "", "Mokoroa"),
    ("Vimal Singh", "Kāinga Leader", "", "Mokoroa"),
    ("Ziad Abdelmaksoud", "Teacher", "", "Mokoroa"),
    ("Boran Alkhudairi", "Teacher", "", "Mokoroa"),
    ("Matthew Garrat", "Teacher", "", "Mokoroa"),
    ("Pramod Gundu", "Teacher", "", "Mokoroa"),
    ("TK Hards", "Teacher", "", "Mokoroa"),
    ("Miu Hon", "Teacher", "", "Mokoroa"),
    ("Ruben Rameka", "Teacher", "", "Mokoroa"),
    ("Mala Karan", "Teacher", "", "Mokoroa"),
    ("Menglu Liu", "Teacher", "", "Mokoroa"),
    ("Rupesh Kumar", "Teacher", "", "Mokoroa"),
    ("Sangeeta Rao", "Teacher", "", "Mokoroa"),
    ("Nilesh Sharma", "Teacher", "", "Mokoroa"),
    ("Manish Tanna", "Teacher", "", "Mokoroa"),
    ("To'asavilli Talea", "Teacher", "", "Mokoroa"),
    ("Yoshna Reddy", "Teacher", "", "Mokoroa"),
    ("Jason Clarkson", "Teacher", "", "Mokoroa"),
    ("Jill de Roos", "Teacher", "", "Mokoroa"),
    ("Riteshni Gounder", "Teacher", "", "Mokoroa"),
    ("Suresh Prasad", "Teacher", "", "Mokoroa"),
    ("Camille Zhang", "Teacher", "", "Mokoroa"),


    # ==========================
    # Pūkeko
    # ==========================

    ("Michael Cylne", "Deputy Principal", "", "Pūkeko"),
    ("Geraldine Jagesur-Singh", "Kāinga Leader", "", "Pūkeko"),
    ("Selina Yee", "Kāinga Leader", "", "Pūkeko"),
    ("Ritesh Sharma", "Kāinga Leader", "", "Pūkeko"),
    ("Shams Al-Chalabi", "Teacher", "", "Pūkeko"),
    ("Neil Bather", "Teacher", "", "Pūkeko"),
    ("Swastika Devi", "Teacher", "", "Pūkeko"),
    ("Jonathan Megchelse", "Teacher", "", "Pūkeko"),
    ("Barbara Ngawati-Salaivao", "Teacher", "", "Pūkeko"),
    ("Rakesh Prakash", "Teacher", "", "Pūkeko"),
    ("Raman Virk", "Teacher", "", "Pūkeko"),
    ("Wille Ropata", "Teacher", "", "Pūkeko"),
    ("Jeannine Ashford", "Teacher", "", "Pūkeko"),
    ("Sheenal Chandra", "Teacher", "", "Pūkeko"),
    ("Nicole Tabolt Da-Silva", "Teacher", "", "Pūkeko"),
    ("Stanley Eda", "Teacher", "", "Pūkeko"),
    ("Shital Juthani", "Teacher", "", "Pūkeko"),
    ("Nicola Brebner", "Teacher", "", "Pūkeko"),
    ("Charles Hwang", "Teacher", "", "Pūkeko"),
    ("Bhupendra Singh", "Teacher", "", "Pūkeko"),
    ("David Avulamanda", "Teacher", "", "Pūkeko"),
    ("Brendan Austin", "Teacher", "", "Pūkeko"),
    ("Shikha Arora", "Teacher", "", "Pūkeko"),
    ("Peter Erhand", "Teacher", "", "Pūkeko"),
    ("Meg Goldthorpe", "Teacher", "", "Pūkeko"),
    ("Sachindra Pillay", "Teacher", "", "Pūkeko"),
    ("Rajesh Joshi", "Teacher", "", "Pūkeko"),
    ("Josh Rao", "Teacher", "", "Pūkeko"),
    ("Caitlin Rarity", "Teacher", "", "Pūkeko"),


    # ==========================
    # Pūngāwerewere
    # ==========================

    ("Gavin Lambert", "Deputy Principal", "", "Pūngāwerewere"),
    ("Hayden Guptill", "Kāinga Leader", "", "Pūngāwerewere"),
    ("Michelle Harvey", "Kāinga Leader", "", "Pūngāwerewere"),
    ("Seetha Singh", "Kāinga Leader", "", "Pūngāwerewere"),
    ("Wiaam Al Salihi", "Teacher", "", "Pūngāwerewere"),
    ("Wayne Atkins", "Teacher", "", "Pūngāwerewere"),
    ("Kaitlin Bethell", "Teacher", "", "Pūngāwerewere"),
    ("Michael Charlton", "Teacher", "", "Pūngāwerewere"),
    ("Letitia Deng", "Teacher", "", "Pūngāwerewere"),
    ("Shakil Chand", "Teacher", "", "Pūngāwerewere"),
    ("Araadhana Sharma", "Teacher", "", "Pūngāwerewere"),
    ("Dorena Deo", "Teacher", "", "Pūngāwerewere"),
    ("Connie Chan", "Teacher", "", "Pūngāwerewere"),
    ("Angela Finestone", "Teacher", "", "Pūngāwerewere"),
    ("Shontelle Helg", "Teacher", "", "Pūngāwerewere"),
    ("Prem Chandra", "Teacher", "", "Pūngāwerewere"),
    ("Sophie Irvine", "Teacher", "", "Pūngāwerewere"),
    ("Jenny Lim", "Teacher", "", "Pūngāwerewere"),
    ("Chris Pretty", "Teacher", "", "Pūngāwerewere"),
    ("Ian Rey Catubigan", "Teacher", "", "Pūngāwerewere"),
    ("Avitha Sutton", "Teacher", "", "Pūngāwerewere"),
    ("Rene Cowley", "Teacher", "", "Pūngāwerewere")

]

cursor.executemany("""
INSERT INTO teachers
(name, role, email, kainga)
VALUES (?, ?, ?, ?)
""", teachers)

# ==========================================================
# ROOMS LIST
# ==========================================================

rooms = [

    ("Papa1","Papatūānuku Inner 1"),
    ("Papa2","Papatūānuku Inner 2"),
    ("PapaO","Papatūānuku Outer"),
    ("PapaPS","Papatūānuku Presentation"),
    ("PapaPD","Papatūānuku Pod"),

    ("Pung1","Pūngāwerewere Inner 1"),
    ("Pung2","Pūngāwerewere Inner 2"),
    ("PungO","Pūngāwerewere Outer"),
    ("PungPS","Pūngāwerewere Presentation"),
    ("PungPD","Pūngāwerewere Pod"),

    ("Kahi1","Kahikatea Inner 1"),
    ("Kahi2","Kahikatea Inner 2"),
    ("KahiO","Kahikatea Outer"),
    ("KahiPS","Kahikatea Presentation"),
    ("KahiPD","Kahikatea Pod"),

    ("Puke1","Pūkeko Inner 1"),
    ("Puke2","Pūkeko Inner 2"),
    ("PukeO","Pūkeko Outer"),
    ("PukePS","Pūkeko Presentation"),
    ("PukePD","Pūkeko Pod"),

    ("Hara1","Harakeke Inner 1"),
    ("Hara2","Harakeke Inner 2"),
    ("HaraO","Harakeke Outer"),
    ("HaraPS","Harakeke Presentation"),
    ("HaraPD","Harakeke Pod"),

    ("Moko1","Mokoroa Inner 1"),
    ("Moko2","Mokoroa Inner 2"),
    ("MokoO","Mokoroa Outer"),
    ("MokoPS","Mokoroa Presentation"),
    ("MokoPD","Mokoroa Pod"),

    ("Waka1","Waka Inner 1"),
    ("Waka2","Waka Inner 2"),
    ("WakaO","Waka Outer"),
    ("WakaPS","Waka Presentation"),
    ("WakaPD","Waka Pod"),

    ("Kea1","Kea Inner 1"),
    ("Kea2","Kea Inner 2"),
    ("KeaO","Kea Outer"),
    ("KeaPS","Kea Presentation"),
    ("KeaPD","Kea Pod"),

    ("Ngah1","Ngahere Inner 1"),
    ("Ngah2","Ngahere Inner 2"),
    ("NgahO1","Ngahere Outer 1"),
    ("NgahO2","Ngahere Outer 2"),
    ("NgahP1","Ngahere Pod 1"),
    ("NgahP2","Ngahere Pod 2"),
    ("NgahP3","Ngahere Pod 3"),
    ("NgahP4","Ngahere Pod 4"),

]

cursor.executemany("""
INSERT INTO rooms
(code, name)
VALUES (?, ?)
""", rooms)

# ==========================================================
# TIMETABLE
# ==========================================================

slots = [

    # Monday
    (1,1,"09:00","10:30"),
    (1,2,"10:50","12:20"),
    (1,6,"13:10","13:35"),
    (1,3,"13:40","14:30"),
    (1,4,"14:35","15:25"),

    # Tuesday
    (2,6,"09:00","10:30"),
    (2,5,"10:50","12:20"),
    (2,4,"13:10","14:00"),
    (2,1,"14:05","14:55"),

    # Wednesday
    (3,3,"09:00","10:30"),
    (3,4,"10:50","12:20"),
    (3,6,"13:10","13:35"),
    (3,2,"13:40","14:30"),
    (3,5,"14:35","15:25"),

    # Thursday
    (4,4,"09:00","09:50"),
    (4,5,"09:55","10:45"),
    (4,3,"11:05","11:55"),
    (4,6,"12:00","12:50"),
    (4,1,"13:40","14:30"),
    (4,2,"14:35","15:25"),

    # Friday
    (5,5,"09:00","09:50"),
    (5,2,"09:55","10:45"),
    (5,1,"11:05","11:55"),
    (5,3,"12:00","12:50"),
    (5,6,"13:40","14:55")

]

cursor.executemany("""
INSERT INTO timetable_slots
(day,session,start_time,end_time)
VALUES (?,?,?,?)
""", slots)

# ==========================================================
# COURSE SCHEDULE
# Admin page will populate this later
# ==========================================================

schedule = [

]

cursor.executemany("""
INSERT INTO course_schedule
(course_id,teacher_id,room_id,day,session)
VALUES (?,?,?,?,?)
""", schedule)

connection.commit()
connection.close()

print("✅ StudentNET database created successfully!")