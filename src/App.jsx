import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from './components/Navbar';
import Canvas2D from './components/Canvas2D';
import Canvas3D from './components/Canvas3D';
import DominanceDAG from './components/DominanceDAG';
import DominanceMatrix from './components/DominanceMatrix';
import NDFTriangle from './components/NDFTriangle';
import TheoryQA from './components/TheoryQA';
import BottomDock from './components/BottomDock';
import PasteModal from './components/PasteModal';
import ExcelUploadModal from './components/ExcelUploadModal';

import { generateFNDSSteps } from './engine/fnds';
import { generateENSSteps } from './engine/ens_ss';
import { generateENSBSSteps } from './engine/ens_bs';
import { generateNaiveNDSSteps } from './engine/naive_nds';

import {
  parseXlsxBuffer,
  inspectExcelWorkbook,
  createSampleExcelWorkbook
} from './parsers/xlsx_parser';
import { parseDelimitedText } from './parsers/csv_parser';
import { exportToCSV, exportToXLSX, downloadFile } from './parsers/dataset_exporter';
import { PRESETS, generateRandomPopulation } from './data/presets';

import { Network, Table, Triangle, BookOpen } from 'lucide-react';

export default function App() {
  const [population, setPopulation] = useState(PRESETS.paperFigure1.points);
  const [selectedAlgo, setSelectedAlgo] = useState('fnds');
  const [selectedPreset, setSelectedPreset] = useState('paperFigure1');
  const [dimensionMode, setDimensionMode] = useState('2d');
  const [activeTab, setActiveTab] = useState('dag'); // 'dag', 'matrix', 'ndf', 'theory'

  // Multi-Objective & Dimensions State
  const [objectiveNames, setObjectiveNames] = useState(['f1', 'f2']);
  const [minimizeDirections, setMinimizeDirections] = useState([true, true]);
  const [projectionAxes, setProjectionAxes] = useState({ x: 0, y: 1, z: 2 });

  // Playback simulation state
  const [steps, setSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepSpeed, setStepSpeed] = useState(400);
  const [totalComparisons, setTotalComparisons] = useState(0);
  const [finalFronts, setFinalFronts] = useState([]);
  const [crowdingDistances, setCrowdingDistances] = useState({});
  const [withinFrontRanks, setWithinFrontRanks] = useState({});
  const [sortByCrowdingDistance, setSortByCrowdingDistance] = useState(true);

  // Modals & Toasts
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelModalData, setExcelModalData] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const playTimerRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  }, []);

  // Run selected algorithm engine
  const runAlgorithm = useCallback((
    newPop = population,
    algo = selectedAlgo,
    resetStep = true,
    minDirs = minimizeDirections
  ) => {
    let result;
    if (algo === 'fnds') {
      result = generateFNDSSteps(newPop, minDirs);
    } else if (algo === 'ens_ss') {
      result = generateENSSteps(newPop, minDirs);
    } else if (algo === 'ens_bs') {
      result = generateENSBSSteps(newPop, minDirs);
    } else {
      result = generateNaiveNDSSteps(newPop, minDirs);
    }

    setSteps(result.steps);
    setFinalFronts(result.fronts);
    setCrowdingDistances(result.crowdingDistances || {});
    setWithinFrontRanks(result.withinFrontRanks || {});
    setTotalComparisons(result.totalComparisons);

    if (resetStep || stepIndex >= result.steps.length) {
      setStepIndex(0);
    }
  }, [population, selectedAlgo, stepIndex, minimizeDirections]);

  // Handle Preset Selection
  useEffect(() => {
    if (selectedPreset === 'random') {
      const dims = dimensionMode === '3d' ? 3 : 2;
      const pts = generateRandomPopulation(12, dims);
      const names = Array.from({ length: dims }, (_, i) => `f${i + 1}`);
      const dirs = Array.from({ length: dims }, () => true);

      setPopulation(pts);
      setObjectiveNames(names);
      setMinimizeDirections(dirs);
      setProjectionAxes({ x: 0, y: 1, z: 2 });
      runAlgorithm(pts, selectedAlgo, true, dirs);
    } else if (PRESETS[selectedPreset]) {
      const presetObj = PRESETS[selectedPreset];
      const pts = presetObj.points.map(p => ({
        id: p.id,
        name: p.name,
        coords: [...p.coords]
      }));

      const dims = presetObj.dimensions || pts[0]?.coords?.length || 2;
      const names = presetObj.objectiveNames || Array.from({ length: dims }, (_, i) => `f${i + 1}`);
      const dirs = presetObj.minimizeDirections || Array.from({ length: dims }, () => true);

      setPopulation(pts);
      setObjectiveNames(names);
      setMinimizeDirections(dirs);
      setProjectionAxes({ x: 0, y: Math.min(1, dims - 1), z: Math.min(2, dims - 1) });

      if (dims === 3) {
        setDimensionMode('3d');
      } else if (dims === 2) {
        setDimensionMode('2d');
      }

      runAlgorithm(pts, selectedAlgo, true, dirs);
    }
  }, [selectedPreset]);

  // Handle Algorithm change
  useEffect(() => {
    runAlgorithm(population, selectedAlgo, true, minimizeDirections);
  }, [selectedAlgo]);

  // Playback Step Timer
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setStepIndex(prev => {
          if (prev < steps.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, stepSpeed);
    } else {
      clearInterval(playTimerRef.current);
    }
    return () => clearInterval(playTimerRef.current);
  }, [isPlaying, stepSpeed, steps.length]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase())) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        setStepIndex(prev => Math.min(steps.length - 1, prev + 1));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        setStepIndex(prev => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [steps.length]);

  // Playback control actions
  const togglePlay = () => {
    if (stepIndex >= steps.length - 1) {
      setStepIndex(0);
    }
    setIsPlaying(prev => !prev);
  };

  const stepForward = () => {
    setIsPlaying(false);
    setStepIndex(prev => Math.min(steps.length - 1, prev + 1));
  };

  const stepBackward = () => {
    setIsPlaying(false);
    setStepIndex(prev => Math.max(0, prev - 1));
  };

  const resetPlayback = () => {
    setIsPlaying(false);
    setStepIndex(0);
  };

  // Add Point handler
  const handleAddPoint = ({ name, coords }) => {
    const ptId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newPt = {
      id: ptId,
      name: name || `P${population.length + 1}`,
      coords
    };
    const updated = [...population, newPt];
    setPopulation(updated);
    runAlgorithm(updated, selectedAlgo, true, minimizeDirections);
    showToast(`Added ${newPt.name} at [${coords.join(', ')}]`);
  };

  const handleCanvasClick = (x, y) => {
    const name = `P${population.length + 1}`;
    const M = objectiveNames.length || population[0]?.coords?.length || 2;
    const coords = Array.from({ length: M }, (_, idx) => {
      if (idx === projectionAxes.x) return x;
      if (idx === projectionAxes.y) return y;
      return 5.0;
    });
    handleAddPoint({ name, coords });
  };

  const handlePointMoved = useCallback((movedPoint) => {
    setPopulation(prev => {
      const updated = prev.map(p => (p.id === movedPoint.id ? movedPoint : p));
      runAlgorithm(updated, selectedAlgo, false, minimizeDirections);
      return updated;
    });
  }, [runAlgorithm, selectedAlgo, minimizeDirections]);

  // Central dataset application helper
  const applyLoadedDataset = ({ points, objectiveNames: names, minimizeDirections: dirs, fileName, sheetName }) => {
    setPopulation(points);
    setObjectiveNames(names);
    setMinimizeDirections(dirs);

    const dims = names.length;
    setProjectionAxes({ x: 0, y: Math.min(1, dims - 1), z: Math.min(2, dims - 1) });

    if (dims === 3) {
      setDimensionMode('3d');
    } else {
      setDimensionMode('2d');
    }

    runAlgorithm(points, selectedAlgo, true, dirs);
    showToast(
      `Loaded ${points.length} points with ${dims} objectives from ${fileName}${sheetName ? ` [${sheetName}]` : ''}!`
    );
  };

  // File Upload (.xlsx, .xls, .csv, .tsv)
  const handleFileUpload = async (file) => {
    try {
      const fileName = file.name.toLowerCase();
      const isSpreadsheet =
        fileName.endsWith('.xlsx') ||
        fileName.endsWith('.xls') ||
        fileName.endsWith('.csv') ||
        fileName.endsWith('.tsv') ||
        fileName.endsWith('.txt');

      if (isSpreadsheet) {
        const buffer = await file.arrayBuffer();
        const inspected = inspectExcelWorkbook(buffer, file.name);

        const firstSheet = inspected.sheetNames[0];
        const detected = inspected.detectedConfigs[firstSheet];
        const numCols = detected?.columns?.length || 0;

        // If file has multiple columns (>2) or multiple sheets or is an excel binary, launch interactive modal
        if (
          inspected.sheetNames.length > 1 ||
          numCols > 3 ||
          fileName.endsWith('.xlsx') ||
          fileName.endsWith('.xls')
        ) {
          setExcelModalData(inspected);
          setIsExcelModalOpen(true);
          return;
        }

        // Quick auto-load simple 2-column datasets
        const parsed = await parseXlsxBuffer(buffer);
        if (parsed.length > 0) {
          const names = parsed.objectiveNames || ['f1', 'f2'];
          const dirs = parsed.minimizeDirections || [true, true];
          applyLoadedDataset({
            points: parsed,
            objectiveNames: names,
            minimizeDirections: dirs,
            fileName: file.name
          });
          return;
        }
      }

      // Fallback delimited parser
      const text = await file.text();
      const parsed = parseDelimitedText(text);
      if (parsed.length > 0) {
        const dims = parsed[0].coords.length;
        const names = Array.from({ length: dims }, (_, i) => `f${i + 1}`);
        const dirs = Array.from({ length: dims }, () => true);
        applyLoadedDataset({
          points: parsed,
          objectiveNames: names,
          minimizeDirections: dirs,
          fileName: file.name
        });
      } else {
        alert('Could not parse numeric columns in file.');
      }
    } catch (err) {
      console.error('File parsing error:', err);
      alert(`Error reading file: ${err.message}`);
    }
  };

  // Clipboard Paste handler
  const handlePasteImport = (text) => {
    const parsed = parseDelimitedText(text);
    if (parsed.length > 0) {
      const dims = parsed[0].coords.length;
      const names = Array.from({ length: dims }, (_, i) => `f${i + 1}`);
      const dirs = Array.from({ length: dims }, () => true);
      applyLoadedDataset({
        points: parsed,
        objectiveNames: names,
        minimizeDirections: dirs,
        fileName: 'Clipboard Paste'
      });
    } else {
      alert('Could not parse numeric columns. Check format.');
    }
  };

  // Download Sample Excel Template
  const handleDownloadSample = (type = '2d') => {
    const buf = createSampleExcelWorkbook(type);
    downloadFile(
      buf,
      `nds_sample_${type}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    showToast(`Downloaded sample Excel template: nds_sample_${type}.xlsx`);
  };

  // Export Results to Excel (.xlsx)
  const handleExportXLSX = () => {
    const currentStep = steps[stepIndex] || steps[steps.length - 1];
    const rankMap = currentStep?.frontRank || {};
    const domCounts = currentStep?.dominationCounts || null;
    const domSets = currentStep?.dominanceSets || null;
    const cdMap = currentStep?.crowdingDistances || crowdingDistances;
    const wfMap = currentStep?.withinFrontRanks || withinFrontRanks;

    const buf = exportToXLSX(
      population,
      rankMap,
      domCounts,
      domSets,
      cdMap,
      wfMap,
      objectiveNames,
      minimizeDirections,
      selectedAlgo.toUpperCase()
    );

    downloadFile(
      buf,
      `nds_results_${selectedAlgo}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    showToast('Exported multi-sheet results to Excel (.xlsx)!');
  };

  // Export Results to CSV
  const handleExportCSV = () => {
    const currentStep = steps[stepIndex] || steps[steps.length - 1];
    const rankMap = currentStep?.frontRank || {};
    const domCounts = currentStep?.dominationCounts || null;
    const domSets = currentStep?.dominanceSets || null;
    const cdMap = currentStep?.crowdingDistances || crowdingDistances;
    const wfMap = currentStep?.withinFrontRanks || withinFrontRanks;

    const csv = exportToCSV(
      population,
      rankMap,
      domCounts,
      domSets,
      cdMap,
      wfMap,
      objectiveNames,
      minimizeDirections
    );
    downloadFile(csv, `nds_results_${selectedAlgo}.csv`);
    showToast('Exported results to CSV with Crowding Distance!');
  };

  const activeStep = steps[stepIndex] || null;
  const currentDimensionsCount = objectiveNames.length || population[0]?.coords?.length || 2;

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        selectedAlgo={selectedAlgo}
        setSelectedAlgo={setSelectedAlgo}
        selectedPreset={selectedPreset}
        setSelectedPreset={setSelectedPreset}
        dimensionMode={dimensionMode}
        setDimensionMode={setDimensionMode}
        sortByCrowdingDistance={sortByCrowdingDistance}
        setSortByCrowdingDistance={(val) => {
          const nextVal = typeof val === 'function' ? val(sortByCrowdingDistance) : val;
          setSortByCrowdingDistance(nextVal);
          showToast(
            nextVal
              ? 'Crowding distance ranking view enabled (Front & Within-Front ranks highlighted)'
              : 'Crowding distance ranking view disabled'
          );
        }}
        populationCount={population.length}
        comparisonsCount={totalComparisons}
        frontsCount={finalFronts.length}
        dimensionsCount={currentDimensionsCount}
      />

      {/* Main Workspace */}
      <main className="main-workspace">
        {/* Left: 2D or 3D Coordinate Canvas */}
        {dimensionMode === '2d' ? (
          <Canvas2D
            population={population}
            activeStep={activeStep}
            finalFronts={finalFronts}
            crowdingDistances={crowdingDistances}
            withinFrontRanks={withinFrontRanks}
            objectiveNames={objectiveNames}
            minimizeDirections={minimizeDirections}
            projectionAxes={projectionAxes}
            onProjectionAxesChange={setProjectionAxes}
            onCanvasClick={handleCanvasClick}
            onPointMoved={handlePointMoved}
            sortByCrowdingDistance={sortByCrowdingDistance}
          />
        ) : (
          <Canvas3D
            population={population}
            activeStep={activeStep}
            finalFronts={finalFronts}
            crowdingDistances={crowdingDistances}
            withinFrontRanks={withinFrontRanks}
            objectiveNames={objectiveNames}
            minimizeDirections={minimizeDirections}
            projectionAxes={projectionAxes}
            onProjectionAxesChange={setProjectionAxes}
            sortByCrowdingDistance={sortByCrowdingDistance}
          />
        )}

        {/* Right: Analytical Workbench */}
        <aside className="workbench-pane">
          <nav className="workbench-nav">
            <button
              className={`nav-tab-btn ${activeTab === 'dag' ? 'active' : ''}`}
              onClick={() => setActiveTab('dag')}
            >
              <Network size={14} />
              <span>Dominance DAG</span>
            </button>
            <button
              className={`nav-tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
              onClick={() => setActiveTab('matrix')}
            >
              <Table size={14} />
              <span>Tables 1, 2 &amp; 3 Matrix</span>
            </button>
            <button
              className={`nav-tab-btn ${activeTab === 'ndf' ? 'active' : ''}`}
              onClick={() => setActiveTab('ndf')}
            >
              <Triangle size={14} />
              <span>NDF Triangle</span>
            </button>
            <button
              className={`nav-tab-btn ${activeTab === 'theory' ? 'active' : ''}`}
              onClick={() => setActiveTab('theory')}
            >
              <BookOpen size={14} />
              <span>Theory &amp; Q&amp;A</span>
            </button>
          </nav>

          <div className="workbench-content">
            {activeTab === 'dag' && (
              <DominanceDAG
                population={population}
                activeStep={activeStep}
                finalFronts={finalFronts}
                crowdingDistances={crowdingDistances}
                withinFrontRanks={withinFrontRanks}
                minimizeDirections={minimizeDirections}
                sortByCrowdingDistance={sortByCrowdingDistance}
              />
            )}
            {activeTab === 'matrix' && (
              <DominanceMatrix
                population={population}
                activeStep={activeStep}
                finalFronts={finalFronts}
                crowdingDistances={crowdingDistances}
                withinFrontRanks={withinFrontRanks}
                objectiveNames={objectiveNames}
                minimizeDirections={minimizeDirections}
                sortByCrowdingDistance={sortByCrowdingDistance}
              />
            )}
            {activeTab === 'ndf' && <NDFTriangle />}
            {activeTab === 'theory' && <TheoryQA />}
          </div>
        </aside>
      </main>

      {/* Bottom Dock */}
      <BottomDock
        activeStep={activeStep}
        stepIndex={stepIndex}
        totalSteps={steps.length}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        stepForward={stepForward}
        stepBackward={stepBackward}
        resetPlayback={resetPlayback}
        stepSpeed={stepSpeed}
        setStepSpeed={setStepSpeed}
        onAddPoint={handleAddPoint}
        onFileUpload={handleFileUpload}
        onOpenPasteModal={() => setIsPasteModalOpen(true)}
        onDownloadSample={handleDownloadSample}
        onExportCSV={handleExportCSV}
        onExportXLSX={handleExportXLSX}
        objectiveNames={objectiveNames}
      />

      {/* Excel Column Mapping & Importer Modal */}
      <ExcelUploadModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        workbookData={excelModalData}
        onConfirm={applyLoadedDataset}
      />

      {/* Clipboard Paste Modal */}
      <PasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onImport={handlePasteImport}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div id="app-toast" className="visible">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
