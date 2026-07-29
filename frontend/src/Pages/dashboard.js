import "./dashboard.css";

function Dashboard() {

    const firstName = localStorage.getItem("firstName") || "Student";

    const subjects = [
        "Statistics",
        "Business",
        "English Projects",
        "Computer Science",
        "Accounting"
    ];

    const timetable = [
        {
            time: "09:00",
            subject: "Statistics",
            room: "Papatūānuku"
        },
        {
            time: "10:50",
            subject: "Business",
            room: "Mahutonga"
        },
        {
            time: "13:10",
            subject: "Learning Advisor",
            room: "Kāinga"
        },
        {
            time: "13:40",
            subject: "Computer Science",
            room: "Technology"
        },
        {
            time: "14:35",
            subject: "Accounting",
            room: "Commerce"
        }
    ];

    return (

        <div className="dashboard">

            <h1 className="page-title">
                Dashboard
            </h1>

            <p className="page-subtitle">
                Welcome back, {firstName}.
            </p>

            <div className="dashboard-grid">

                <div className="dashboard-card">

                    <h2>Today's Lessons</h2>

                    <div className="large-number">
                        5
                    </div>

                    <p>
                        Statistics • 09:00–10:30
                    </p>

                </div>

                <div className="dashboard-card">

                    <h2>Notices</h2>

                    <p>
                        No notices today.
                    </p>

                    <p className="coming-soon">
                        School notices will appear here.
                    </p>

                </div>

                <div className="dashboard-card">

                    <h2>My Subjects</h2>

                    {subjects.map(subject => (

                        <div
                            key={subject}
                            className="subject-pill"
                        >
                            {subject}
                        </div>

                    ))}

                </div>

                <div className="dashboard-card">

                    <h2>📈 Attendance</h2>

                    <div className="large-number">
                        --
                    </div>

                </div>

            </div>


        </div>

    );

}

export default Dashboard;