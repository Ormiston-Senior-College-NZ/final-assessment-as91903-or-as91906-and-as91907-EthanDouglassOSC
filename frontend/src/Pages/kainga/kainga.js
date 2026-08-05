/*
 * KĀINGA PAGE
 * This route currently provides a labelled placeholder for future Kāinga
 * community content. It intentionally has no data loading or local state yet.
 */
import AdminView from "../../Components/adminView";

function Kainga() {
  return localStorage.getItem("isAdmin") === "true" ? (
    <AdminView page="kainga" />
  ) : (
    <main>
      <h1>Kāinga</h1>
      <p>Your Kāinga community page is coming soon.</p>
    </main>
  );
}

export default Kainga;
