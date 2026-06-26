import { useState } from 'react'
import { Plus, ChevronDown } from 'lucide-react'

const fuelTypes = ['Regular (87-88)', 'Midgrade (89-90)', 'Premium (91-94)', 'Diesel', 'Other']
const axleConfigs = ['4x2', '6x4', '8x4', 'Other']

interface Props {
  onClose: () => void
  onAdd: (name: string) => void
}

interface FormState {
  cabName: string
  eld: string
  vin: string
  plate: string
  fuel: string
  hitch: string
  axle: string
  tank: string
  mpg: string
}

const empty: FormState = {
  cabName: '',
  eld: '',
  vin: '',
  plate: '',
  fuel: '',
  hitch: '',
  axle: '',
  tank: '',
  mpg: '',
}

export default function AddCabModal({ onClose, onAdd }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState<FormState>(empty)
  const set = <K extends keyof FormState>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    onAdd(form.cabName.trim() || 'New cab')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="title">
            <Plus size={18} />
            <span>Add new cab</span>
          </div>
          <span className="modal-step">{step}/2</span>
        </div>

        <div className="modal-body">
          {step === 1 ? (
            <>
              <Field
                label="Cab Name"
                placeholder="Write the Cab Name"
                value={form.cabName}
                onChange={(v) => set('cabName', v)}
                help="Required"
              />
              <Field
                label="ELD"
                placeholder="Write the ELD ID"
                value={form.eld}
                onChange={(v) => set('eld', v)}
                help="Optional"
              />
              <Field
                label="Vehicle Identification Number (VIN)"
                placeholder="Write the Vehicle Identification Number"
                value={form.vin}
                onChange={(v) => set('vin', v)}
                help="Optional"
              />
              <Field
                label="License Plate Number"
                placeholder="Write the License plate Number"
                value={form.plate}
                onChange={(v) => set('plate', v)}
                help="Optional"
              />
            </>
          ) : (
            <>
              <SelectField
                label="Fuel type"
                placeholder="Choose fuel type"
                value={form.fuel}
                options={fuelTypes}
                onChange={(v) => set('fuel', v)}
                help="Required"
              />
              <Field
                label="Maximum Hitch"
                placeholder="Write Maximum Hitch"
                value={form.hitch}
                onChange={(v) => set('hitch', v)}
                suffix="lb"
                help="Optional"
              />
              <SelectField
                label="Axle Configuration"
                placeholder="Choose Axle Configuration"
                value={form.axle}
                options={axleConfigs}
                onChange={(v) => set('axle', v)}
                help="Optional"
              />
              <Field
                label="Tank Capacity"
                placeholder="0 gal"
                value={form.tank}
                onChange={(v) => set('tank', v)}
                help="Required"
              />
              <Field
                label="Estimated Miles per Gallon (MPG)"
                placeholder="0 mpg"
                value={form.mpg}
                onChange={(v) => set('mpg', v)}
                help="Required"
              />
            </>
          )}
        </div>

        <div className="modal-foot">
          {step === 1 ? (
            <>
              <button className="btn-text" onClick={onClose}>
                Cancel
              </button>
              <button className="btn-pill" onClick={() => setStep(2)}>
                Next
              </button>
            </>
          ) : (
            <>
              <button className="btn-text" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn-pill" onClick={submit}>
                Add
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  help,
  suffix,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  help?: string
  suffix?: string
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-input">
        <input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </div>
      {help && <div className="field-help">{help}</div>}
    </div>
  )
}

function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
  help,
}: {
  label: string
  placeholder: string
  value: string
  options: string[]
  onChange: (v: string) => void
  help?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="field">
      <label>{label}</label>
      <div className="select">
        <button
          className={`select-trigger ${open ? 'open' : ''} ${value ? 'has-value' : ''}`}
          onClick={() => setOpen((o) => !o)}
        >
          <span>{value || placeholder}</span>
          <ChevronDown size={16} color="var(--text-dim)" />
        </button>
        {open && (
          <>
            <div className="select-backdrop" onClick={() => setOpen(false)} />
            <div className="select-menu">
              {options.map((opt) => (
                <button
                  key={opt}
                  className="select-opt"
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {help && <div className="field-help">{help}</div>}
    </div>
  )
}
