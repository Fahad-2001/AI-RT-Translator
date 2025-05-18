import RealTimeTranslatorApp from "./components/RealTimeTranslatorApp"
import { ThemeProvider } from "./components/theme-provider"
import "./App.css"

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="translator-theme">
      <div className="App min-h-screen bg-background">
        <RealTimeTranslatorApp />
      </div>
    </ThemeProvider>
  )
}

export default App
