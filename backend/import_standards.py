import csv
import os


DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "nzqa_achievement_standards_2024.csv")


def matches_course(course_code, standard):
    prefix = "".join(character for character in course_code if character.isalpha())
    domain = standard["domain"].lower()
    subfield = standard["subfield"].lower()
    mappings = {
        "ENG": ("english",), "ENP": ("english",), "ESL": ("english",), "ELL": ("english",),
        "MAO": ("reo maori", "te reo mäori", "te reo rangatira"), "TAH": ("te ao haka",),
        "MAT": ("mathematics", "statistics and probability"),
        "CAL": ("algebra", "calculus", "trigonometry", "geometry", "mathematical studies"),
        "STA": ("statistics", "probability", "statistics and probability"),
        "BIO": ("biology",), "CHE": ("chemistry",), "PHY": ("physics",),
        "SCI": ("science",), "EFS": ("environmental sustainability",),
        "GEO": ("geography",), "HIS": ("history",), "PAS": ("social studies",),
        "ACC": ("accounting",), "ECO": ("economics",), "BUS": ("business studies",),
        "CSC": ("digital technologies",), "DVC": ("design and visual communication",),
        "PDT": ("generic technology", "construction and mechanical technologies"),
        "COT": ("construction and mechanical technologies",),
        "TEF": ("processing technologies", "home economics"), "HOS": ("home economics", "processing technologies"),
        "DAN": ("dance",), "DRA": ("drama",), "MUS": ("music",),
        "DES": ("visual arts", "practical art"), "PAI": ("visual arts", "practical art"), "PHO": ("visual arts", "practical art"),
        "PED": ("physical education",), "OED": ("physical education",), "HEA": ("health education",),
        "MED": ("media studies",),
    }
    terms = mappings.get(prefix, ())
    return any(term in domain or term in subfield for term in terms)


def import_standards(connection):
    if not os.path.exists(DATA_FILE):
        return 0
    connection.execute("DELETE FROM course_standard_catalog")
    connection.execute("DELETE FROM assessment_catalog")
    with open(DATA_FILE, encoding="utf-8", newline="") as source:
        rows = list(csv.DictReader(source))
    courses = connection.execute("SELECT id, code, level FROM courses").fetchall()
    for standard in rows:
        cursor = connection.execute("""
            INSERT INTO assessment_catalog
                (standard_number, title, level, assessment_type, credits, domain, subfield, source_year)
            VALUES (?, ?, ?, ?, ?, ?, ?, 2024)
        """, (
            standard["standard_number"], standard["title"], int(standard["level"]),
            standard["assessment_type"], int(standard["credits"]),
            standard["domain"], standard["subfield"]
        ))
        standard_id = cursor.lastrowid
        for course in courses:
            course_id, course_code, course_level = course
            allowed_levels = {course_level} if course_level != 23 else {2, 3}
            if int(standard["level"]) in allowed_levels and matches_course(course_code, standard):
                connection.execute("""
                    INSERT OR IGNORE INTO course_standard_catalog (course_id, standard_id)
                    VALUES (?, ?)
                """, (course_id, standard_id))
    return len(rows)


if __name__ == "__main__":
    from database import get_connection
    database = get_connection()
    count = import_standards(database)
    database.commit()
    database.close()
    print(f"Imported {count} NZQA achievement standards.")
