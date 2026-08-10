"""Generate OSC teacher codes consistently from staff names."""

import re


# Correct old seed spellings when an existing database is migrated.
NAME_CORRECTIONS = {
    "Cassandra Hill": "Cassandra Hii",
    "Matthew Garrat": "Matthew Garratt",
    "Michael Cylne": "Michael Clyne",
    "Wille Ropata": "Matua Willie Ropata",
    "To'asavilli Talea": "To'asavili Telea",
    "Nicole Tabolt Da-Silva": "Nicole Tabolt Da Silva",
}

# Staff-specific exceptions used to keep otherwise identical generated codes unique.
CODE_OVERRIDES = {
    "Ian Rey Catubigan": "ICA",
    "Prem Chandra": "PCN",
    "Pritika Chand": "PCA",
    "Shakil Chand": "SCA",
    "Sophie Irvine": "SIV",
}


def teacher_code(name):
    """Build a code from the first initial and first two second-name letters."""
    if name in CODE_OVERRIDES:
        return CODE_OVERRIDES[name]
    words = re.findall(r"[A-Za-z]+", name)
    if len(words) >= 2:
        return f"{words[0][0]}{words[1][:2]}".upper()
    return words[0][:3].upper() if words else "TCH"


def build_teacher_codes(teachers):
    """Return the rule-based code for every ``(id, name)`` teacher record."""
    return {teacher_id: teacher_code(name) for teacher_id, name in teachers}
