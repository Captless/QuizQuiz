import { useEffect, useState } from 'react'
import { suggestTopics } from '../services/api'

const TOPICS: Record<string, Record<string, string[]>> = {
  science: {
    'K-2': ['Animals', 'Plants', 'Weather', 'The Sun', 'Water Cycle', 'Five Senses', 'Seasons', 'Rocks'],
    '3-5': ['Solar System', 'Human Body', 'Ecosystems', 'States of Matter', 'Electricity', 'Simple Machines', 'Food Chains', 'Habitats'],
    '6-8': ['Genetics', 'Chemical Reactions', 'Forces & Motion', 'Cell Biology', 'Plate Tectonics', 'Photosynthesis', 'Evolution', 'Atoms'],
    '9-12': ['Organic Chemistry', 'Quantum Physics', 'Thermodynamics', 'Calculus-Based Physics', 'Molecular Biology', 'Electromagnetism', 'Biochemistry', 'Ecology'],
  },
  math: {
    'K-2': ['Counting', 'Addition', 'Subtraction', 'Shapes', 'Patterns', 'Measurement', 'Time', 'Money'],
    '3-5': ['Multiplication', 'Division', 'Fractions', 'Decimals', 'Geometry', 'Area & Perimeter', 'Graphing', 'Word Problems'],
    '6-8': ['Algebra', 'Ratios', 'Percentages', 'Integers', 'Equations', 'Probability', 'Pythagorean Theorem', 'Statistics'],
    '9-12': ['Calculus', 'Trigonometry', 'Linear Algebra', 'Differential Equations', 'Complex Numbers', 'Matrices', 'Logarithms', 'Vectors'],
  },
  history: {
    'K-2': ['Community Helpers', 'Holidays', 'Long Ago & Today', 'Maps & Globes', 'Flags', 'Famous Americans', 'Transportation', 'Colonial Life'],
    '3-5': ['Ancient Egypt', 'American Revolution', 'Civil War', 'Age of Exploration', 'Ancient Greece', 'Roman Empire', 'Vikings', 'Medieval Times'],
    '6-8': ['World War I', 'World War II', 'Cold War', 'Industrial Revolution', 'Renaissance', 'Ancient Civilizations', 'Middle Ages', 'Colonialism'],
    '9-12': ['US Constitution', 'Civil Rights Movement', 'Vietnam War', 'Great Depression', 'Enlightenment', 'French Revolution', 'Imperial Japan', 'Russian Revolution'],
  },
  english: {
    'K-2': ['Alphabet', 'Phonics', 'Sight Words', 'Rhyming', 'Story Elements', 'Nouns & Verbs', 'Punctuation', 'Capitalization'],
    '3-5': ['Grammar', 'Vocabulary', 'Reading Comprehension', 'Figurative Language', 'Parts of Speech', 'Sentence Structure', 'Writing Process', 'Spelling'],
    '6-8': ['Literary Devices', 'Essay Writing', 'Shakespeare', 'Poetry', 'Short Stories', 'Themes & Motifs', 'Argumentative Writing', 'Research Skills'],
    '9-12': ['British Literature', 'American Literature', 'World Literature', 'AP Language', 'Creative Writing', 'Rhetoric', 'Literary Theory', 'Drama'],
  },
  geography: {
    'K-2': ['Continents', 'Oceans', 'Landforms', 'Weather', 'Maps', 'Directions', 'Community', 'Seasons'],
    '3-5': ['US States', 'World Countries', 'Rivers & Mountains', 'Climate Zones', 'Natural Resources', 'Population', 'Latitude & Longitude', 'Time Zones'],
    '6-8': ['Physical Geography', 'Human Geography', 'Cultural Regions', 'Urbanization', 'Migration', 'Trade Routes', 'Ecosystems', 'Geopolitics'],
    '9-12': ['Cartography', 'Geographic Information Systems', 'Climatology', 'Demographics', 'Economic Geography', 'Political Geography', 'Sustainability', 'Globalization'],
  },
}

interface Props {
  subject: string
  grade: string
  onSelect: (topic: string) => void
}

export default function TopicChips({ subject, grade, onSelect }: Props) {
  const [chips, setChips] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const ai = await suggestTopics(subject, grade)
      if (ai.length > 0) { setChips(ai.slice(0, 5)); setLoading(false); return }
    } catch {}
    const pool = TOPICS[subject]?.[grade]
    if (pool) {
      const shuffled = [...pool].sort(() => Math.random() - 0.5)
      setChips(shuffled.slice(0, 5))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (subject && grade && TOPICS[subject]?.[grade]) {
      setChips(TOPICS[subject][grade].slice(0, 5))
    } else {
      setChips([])
    }
  }, [subject, grade])

  if (!subject || !grade || chips.length === 0) return null

  return (
    <div className="topic-chips">
      <button type="button" onClick={refresh} disabled={loading}
        className={`topic-chip-randomize ${loading ? 'loading' : ''}`}>{loading ? '' : 'Refresh'}</button>
      {chips.map(t => (
        <button key={t} type="button" onClick={() => onSelect(t)}
          className="topic-chip">{t}</button>
      ))}
    </div>
  )
}
