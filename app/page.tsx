import Paint from "./components/paint";

export default function Home() {
  return (
    <div
      className="flex min-h-screen w-screen font-mono overflow-hidden"
      style={{
        backgroundColor: "#f3f4f6", // Tailwind gray-100 (lighter)
        backgroundImage:
          "radial-gradient(rgba(0,0,0,0.055) 2px, transparent 2px), radial-gradient(rgba(0,0,0,0.04) 2px, transparent 2px)",
        backgroundSize: "18px 18px",
        backgroundPosition: "0 0, 9px 9px",
      }}
    >
      <Paint />
    </div>
  );
}
