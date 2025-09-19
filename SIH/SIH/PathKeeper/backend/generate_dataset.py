import csv, random, os

first_names = [
    "Aarav","Vivaan","Aditya","Diya","Ishaan","Priya","Rohan","Saanvi","Aryan","Anika",
    "Kabir","Myra","Vihaan","Zara","Neha","Kunal","Tanvi","Ritika","Arjun","Meera",
    "Dev","Ira","Karan","Nisha","Riya","Ayaan","Sara","Laksh","Pari","Ved","Anaya"
]
last_names = [
    "Sharma","Singh","Kumar","Gupta","Patel","Mehta","Joshi","Reddy","Verma","Roy",
    "Shah","Desai","Nair","Khan","Malik","Agarwal","Bose","Goyal","Kapoor","Bhat",
    "Chopra","Dutta","Pillai","Rastogi","Sarin","Trivedi","Chaudhary","Bhatt","Purohit","Saxena"
]


def generate_new_dataset(num_students: int = 300, seed: int | None = None) -> str:
    """Generate a fresh synthetic dataset CSV and return its path."""
    if seed is not None:
        random.seed(seed)
    else:
        random.seed()

    rows = []
    start_id = 101
    for i in range(num_students):
        sid = start_id + i
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        attendance = max(30, min(100, int(random.gauss(75, 12))))
        score = max(25, min(100, int(random.gauss(70, 15))))
        total_assignments = 10
        assignments_submitted = random.randint(0, total_assignments)
        fees_paid = random.choices([0, 1], [0.2, 0.8])[0]
        rows.append([sid, name, attendance, score, assignments_submitted, total_assignments, fees_paid])

    base_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(base_dir, 'student_data.csv')
    with open(out_path, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow([
            'student_id','name','attendance_percentage','avg_test_score',
            'assignments_submitted','total_assignments','fees_paid'
        ])
        w.writerows(rows)

    return out_path


if __name__ == '__main__':
    path = generate_new_dataset(300, seed=42)
    print('Generated', path)
