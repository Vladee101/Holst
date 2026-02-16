import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';

function App() {
  return (
    <div className="flex h-screen w-full text-zinc-900 bg-zinc-100 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex flex-1 overflow-hidden relative">
        <Canvas />
      </div>
    </div>
  );
}

export default App;
