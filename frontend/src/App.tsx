import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { HomePage } from './pages/HomePage';
import { AskPage } from './pages/AskPage';
import { RoutingFlowPage } from './pages/RoutingFlowPage';
import { ModelComparisonPage } from './pages/ModelComparisonPage';
import { VoicePlaygroundPage } from './pages/VoicePlaygroundPage';
import { SimulationLabPage } from './pages/SimulationLabPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { HistoryPage } from './pages/HistoryPage';
import { ModelConfig, RouteResponse, DemoScenario, RouteRequest } from './types';
import { fetchModels, resetModels } from './services/api';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [lastResponse, setLastResponse] = useState<RouteResponse | null>(null);
  
  // Stored parameters when launching from a scenario or quick prompt
  const [askPrompt, setAskPrompt] = useState<string>('');
  const [askParams, setAskParams] = useState<Partial<RouteRequest>>({});

  const loadModels = async () => {
    try {
      const data = await fetchModels();
      setModels(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleResetModels = async () => {
    try {
      const data = await resetModels();
      setModels(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectScenario = (scenario: DemoScenario) => {
    setAskPrompt(scenario.prompt);
    setAskParams({
      max_latency_ms: scenario.max_latency_ms ?? null,
      max_cost: scenario.max_cost ?? null,
      min_capability: scenario.min_capability ?? null,
      context_override: scenario.context_override ?? null,
      preference: scenario.preference
    });
    setCurrentTab('ask');
  };

  const handleGoToAsk = (initialText?: string) => {
    if (initialText) {
      setAskPrompt(initialText);
      setAskParams({});
    }
    setCurrentTab('ask');
  };

  return (
    <div className="flex flex-col min-h-screen bg-space-950 text-slate-100">
      {/* Top Navigation Bar */}
      <Navbar
        onResetModels={handleResetModels}
        activeModelCount={models.filter((m) => m.available).length}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => setCurrentTab(tab)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'home' && (
              <HomePage
                onSelectScenario={handleSelectScenario}
                onGoToAsk={handleGoToAsk}
                models={models}
              />
            )}

            {currentTab === 'ask' && (
              <AskPage
                initialPrompt={askPrompt}
                initialParams={askParams}
                onRoutingCompleted={(res) => setLastResponse(res)}
                lastResponse={lastResponse}
                setLastResponse={setLastResponse}
              />
            )}

            {currentTab === 'flow' && (
              <RoutingFlowPage
                lastResponse={lastResponse}
                models={models}
                onGoToAsk={() => setCurrentTab('ask')}
              />
            )}

            {currentTab === 'comparison' && (
              <ModelComparisonPage
                models={models}
                lastResponse={lastResponse}
                onGoToFlow={() => setCurrentTab('flow')}
              />
            )}

            {currentTab === 'voice' && (
              <VoicePlaygroundPage
                lastResponse={lastResponse}
                onRoutingCompleted={(res) => setLastResponse(res)}
              />
            )}

            {currentTab === 'simulation' && (
              <SimulationLabPage
                models={models}
                onRefreshModels={loadModels}
                onGoToAsk={() => setCurrentTab('ask')}
              />
            )}

            {currentTab === 'monitoring' && (
              <MonitoringPage />
            )}

            {currentTab === 'history' && (
              <HistoryPage />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
export default App;
