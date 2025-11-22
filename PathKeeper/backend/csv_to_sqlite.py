import csv
import sqlite3
import os

# CSV and DB paths

base_dir = os.path.dirname(os.path.abspath(__file__))
csv_file = os.path.join(base_dir, 'student_data.csv')
db_file = os.path.join(base_dir, 'student_data.db')

def create_table(cursor):
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            student_id INTEGER PRIMARY KEY,
            name TEXT,
            attendance_percentage INTEGER,
            avg_test_score INTEGER,
            assignments_submitted INTEGER,
            total_assignments INTEGER,
            fees_paid INTEGER
        )
    ''')

def csv_to_sqlite():
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    create_table(cursor)
    with open(csv_file, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            cursor.execute('''
                INSERT INTO students (student_id, name, attendance_percentage, avg_test_score, assignments_submitted, total_assignments, fees_paid)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                int(row['student_id']),
                row['name'],
                int(row['attendance_percentage']),
                int(row['avg_test_score']),
                int(row['assignments_submitted']),
                int(row['total_assignments']),
                int(row['fees_paid'])
            ))
    conn.commit()
    conn.close()
    print('CSV data imported into SQLite database successfully.')

def rebuild_db_from_csv():
    """Recreate the SQLite DB from the current CSV, replacing any existing data."""
    # Remove existing DB to avoid UNIQUE constraint issues and stale data
    try:
        if os.path.exists(db_file):
            os.remove(db_file)
    except Exception:
        # Fallback: try to drop the table if file removal fails
        conn = sqlite3.connect(db_file)
        cur = conn.cursor()
        try:
            cur.execute('DROP TABLE IF EXISTS students')
            conn.commit()
        finally:
            conn.close()
    # Import fresh CSV data
    csv_to_sqlite()

if __name__ == '__main__':
    rebuild_db_from_csv()
