export default function FloatingAddButton({ onClick }) {
  return (
    <button className="fab" onClick={onClick} title="Add new task">
      +
    </button>
  );
}