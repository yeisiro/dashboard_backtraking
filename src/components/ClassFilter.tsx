import { useState } from 'react'
import { ChevronDown, Pencil, AlertCircle, Check } from 'lucide-react'

type Mode = 'closed' | 'list' | 'edit'

const classLetters = ['A', 'B', 'C', 'D']

const classNames = ['Class A', 'Class B', 'Class C', 'Class D']

const criteria = ['Money leaks', 'Profitability', 'Efficiency']

// Short explanation of what each criterion ranks assets by.
const criteriaInfo: Record<string, string> = {
  'Money leaks': 'Ranks assets by how much revenue is lost to unbilled or leaking charges.',
  Profitability: 'Ranks assets by their net margin contribution.',
  Efficiency: 'Ranks assets by utilization and operational output.',
}

// Each criterion keeps its own set of class thresholds.
const defaultThresholds: Record<string, Record<string, string>> = {
  'Money leaks': { 'Class A': '0,25', 'Class B': '0,50', 'Class C': '0,75', 'Class D': '1,00' },
  Profitability: { 'Class A': '0,10', 'Class B': '0,30', 'Class C': '0,60', 'Class D': '0,90' },
  Efficiency: { 'Class A': '0,20', 'Class B': '0,40', 'Class C': '0,70', 'Class D': '0,95' },
}

export default function ClassFilter() {
  const [mode, setMode] = useState<Mode>('closed')
  // Empty array = "All". Otherwise a multi-selection of class letters.
  const [selected, setSelected] = useState<string[]>([])
  const [values, setValues] = useState(defaultThresholds)
  const [activeCriteria, setActiveCriteria] = useState('Money leaks')

  const isAll = selected.length === 0
  const label = isAll ? 'All' : selected.join(', ')

  const toggleClass = (letter: string) =>
    setSelected((prev) =>
      prev.includes(letter) ? prev.filter((l) => l !== letter) : [...prev, letter],
    )

  return (
    <div className="cf">
      <button
        className="filter"
        onClick={() => setMode(mode === 'closed' ? 'list' : 'closed')}
      >
        <span>Class:</span>
        <b>{label}</b>
        <ChevronDown className="chev" size={15} />
      </button>

      {mode !== 'closed' && (
        <>
          <div className="cf-backdrop" onClick={() => setMode('closed')} />

          {mode === 'list' && (
            <div className="cf-menu cf-list">
              <button
                className={`cf-item ${isAll ? 'active' : ''}`}
                onClick={() => setSelected([])}
              >
                All class
                {isAll && <Check size={17} className="cf-check" />}
              </button>
              {classLetters.map((letter) => {
                const active = selected.includes(letter)
                return (
                  <button
                    key={letter}
                    className={`cf-item ${active ? 'active' : ''}`}
                    onClick={() => toggleClass(letter)}
                  >
                    Class {letter}
                    {active && <Check size={17} className="cf-check" />}
                  </button>
                )
              })}
              <button className="cf-edit-btn" onClick={() => setMode('edit')}>
                Edit parameters
              </button>
            </div>
          )}

          {mode === 'edit' && (
            <div className="cf-menu cf-edit">
              <div className="cf-edit-head">
                <div className="title">
                  <Pencil size={15} />
                  <span>Edit Parameters</span>
                </div>
                <span
                  className="cf-tip"
                  data-tip="Set the threshold for each class based on the selected criteria."
                >
                  <AlertCircle size={16} color="var(--text-muted)" />
                </span>
              </div>

              <div className="cf-section-label">Criteria</div>
              <div className="cf-criteria">
                {criteria.map((c) => (
                  <button
                    key={c}
                    className={`cf-crit ${activeCriteria === c ? 'active' : ''}`}
                    onClick={() => setActiveCriteria(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="cf-crit-desc">{criteriaInfo[activeCriteria]}</p>

              <div className="cf-section-label">Define Thresholds</div>
              <div className="cf-thresholds">
                {classNames.map((name) => (
                  <div className="cf-thr-row" key={name}>
                    <span className="cf-thr-name">{name}</span>
                    <input
                      className="cf-thr-input"
                      value={values[activeCriteria][name] ?? ''}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [activeCriteria]: {
                            ...v[activeCriteria],
                            [name]: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>

              <button className="cf-apply" onClick={() => setMode('closed')}>
                Apply
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
