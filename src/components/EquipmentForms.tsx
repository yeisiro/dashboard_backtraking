import { useState, type ReactNode } from 'react'
import { Plus, UserPlus } from 'lucide-react'
import type { ManualCab, ManualTrailer } from '../data'

// Manual equipment / driver forms — the same fields and steps as the My
// Company modals ("Add new cab", "Add new trailer", "Add new team member"), so
// an org whose ELD/TMS isn't connected (or that's missing units) can still
// build its fleet during onboarding.

const FUEL_TYPES = ['Regular (87-88)', 'Midgrade (89-90)', 'Premium (91-94)', 'Diesel']
const AXLE_CONFIGS = ['4x2', '6x2', '6x4', '8x4']
const OPERATING_COSTS = ['Fleet default']
const TRAILER_TYPES = ['Van', 'Reefer', 'Flatbed', 'Step Deck', 'Tanker']

function FormHead({ icon, title, step }: { icon: ReactNode; title: string; step?: string }) {
  return (
    <div className="eq-head">
      {icon}
      <span className="eq-title">{title}</span>
      {step && <span className="eq-step">{step}</span>}
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  suffix,
  type = 'text',
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  required?: boolean
  suffix?: string
  type?: 'text' | 'number' | 'email'
  autoFocus?: boolean
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-input">
        <input
          autoFocus={autoFocus}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </div>
      <span className={required ? 'cfm-oblig' : 'eq-optional'}>{required ? 'Required' : 'Optional'}</span>
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-input">
        <select
          className={`eq-select ${value ? '' : 'empty'}`}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <span className={required ? 'cfm-oblig' : 'eq-optional'}>{required ? 'Required' : 'Optional'}</span>
    </div>
  )
}

function Footer({
  secondary,
  onSecondary,
  primary,
  onPrimary,
  disabled,
}: {
  secondary: string
  onSecondary: () => void
  primary: string
  onPrimary: () => void
  disabled: boolean
}) {
  return (
    <div className="eq-foot">
      <button className="btn-text" onClick={onSecondary}>
        {secondary}
      </button>
      <button className="btn-pill" disabled={disabled} onClick={onPrimary}>
        {primary}
      </button>
    </div>
  )
}

const positive = (v: string) => v.trim() !== '' && Number(v) > 0

// ── Add new cab (2 steps) ──
export function AddCabForm({
  takenNames,
  onCancel,
  onAdd,
}: {
  takenNames: string[]
  onCancel: () => void
  onAdd: (cab: ManualCab) => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [eldId, setEldId] = useState('')
  const [vin, setVin] = useState('')
  const [plate, setPlate] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [maxHitch, setMaxHitch] = useState('')
  const [axles, setAxles] = useState('')
  const [tank, setTank] = useState('')
  const [mpg, setMpg] = useState('')
  const [opCost, setOpCost] = useState('')
  const duplicate = takenNames.includes(name.trim())

  return (
    <>
      <FormHead icon={<Plus size={16} />} title="Add new cab" step={`${step}/2`} />
      {step === 1 ? (
        <>
          <TextField label="Cab Name" value={name} onChange={setName} placeholder="Write the cab name" required autoFocus />
          {duplicate && <span className="eq-error">A cab with this name already exists.</span>}
          <TextField label="ELD" value={eldId} onChange={setEldId} placeholder="Write the ELD ID" />
          <TextField
            label="Vehicle Identification Number (VIN)"
            value={vin}
            onChange={setVin}
            placeholder="Write the Vehicle Identification Number"
          />
          <TextField label="License Plate Number" value={plate} onChange={setPlate} placeholder="Write the license plate number" />
          <Footer
            secondary="Cancel"
            onSecondary={onCancel}
            primary="Next"
            onPrimary={() => setStep(2)}
            disabled={!name.trim() || duplicate}
          />
        </>
      ) : (
        <>
          <SelectField
            label="Fuel type"
            value={fuelType}
            onChange={setFuelType}
            options={FUEL_TYPES}
            placeholder="Choose fuel type"
            required
          />
          <TextField
            label="Maximum Hitch"
            value={maxHitch}
            onChange={setMaxHitch}
            placeholder="Write Maximum Hitch"
            suffix="lb"
            type="number"
          />
          <SelectField
            label="Axle Configuration"
            value={axles}
            onChange={setAxles}
            options={AXLE_CONFIGS}
            placeholder="Choose Axle Configuration"
          />
          <div className="eq-row">
            <TextField label="Tank Capacity" value={tank} onChange={setTank} placeholder="0" suffix="gal" type="number" required />
            <TextField
              label="Estimated Miles per Gallon (MPG)"
              value={mpg}
              onChange={setMpg}
              placeholder="0"
              suffix="mpg"
              type="number"
              required
            />
          </div>
          <SelectField
            label="Operating Cost"
            value={opCost}
            onChange={setOpCost}
            options={OPERATING_COSTS}
            placeholder="Select Operating Cost"
          />
          <Footer
            secondary="Back"
            onSecondary={() => setStep(1)}
            primary="Finish"
            disabled={!fuelType || !positive(tank) || !positive(mpg)}
            onPrimary={() =>
              onAdd({
                name: name.trim(),
                eldId: eldId.trim() || undefined,
                vin: vin.trim() || undefined,
                plate: plate.trim() || undefined,
                fuelType,
                maxHitch: maxHitch ? Number(maxHitch) : undefined,
                axleConfig: axles || undefined,
                tankCapacity: Number(tank),
                mpg: Number(mpg),
                operatingCost: opCost || undefined,
              })
            }
          />
        </>
      )}
    </>
  )
}

// ── Add new trailer (2 steps) ──
export function AddTrailerForm({
  takenNames,
  onCancel,
  onAdd,
}: {
  takenNames: string[]
  onCancel: () => void
  onAdd: (trailer: ManualTrailer) => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [type, setType] = useState('')
  const [name, setName] = useState('')
  const [plate, setPlate] = useState('')
  const [weight, setWeight] = useState('')
  const [length, setLength] = useState('53')
  const [width, setWidth] = useState('8.5')
  const [height, setHeight] = useState('9.5')
  const [axles, setAxles] = useState('2')
  const [minTemp, setMinTemp] = useState('')
  const [maxTemp, setMaxTemp] = useState('')
  const duplicate = takenNames.includes(name.trim())
  const num = (v: string) => (v.trim() ? Number(v) : undefined)

  return (
    <>
      <FormHead icon={<Plus size={16} />} title="Add new trailer" step={`${step}/2`} />
      {step === 1 ? (
        <>
          <SelectField
            label="Trailer Type"
            value={type}
            onChange={setType}
            options={TRAILER_TYPES}
            placeholder="Choose trailer type"
            required
          />
          <TextField label="Trailer Name" value={name} onChange={setName} placeholder="Write the trailer name" required />
          {duplicate && <span className="eq-error">A trailer with this name already exists.</span>}
          <TextField label="License Plate Number" value={plate} onChange={setPlate} placeholder="Write the license plate number" />
          <Footer
            secondary="Cancel"
            onSecondary={onCancel}
            primary="Next"
            onPrimary={() => setStep(2)}
            disabled={!type || !name.trim() || duplicate}
          />
        </>
      ) : (
        <>
          <div className="eq-row">
            <TextField label="Weight Capacity" value={weight} onChange={setWeight} placeholder="Enter weight capacity" suffix="lb" type="number" />
            <TextField label="Length" value={length} onChange={setLength} placeholder="0" suffix="ft" type="number" />
          </div>
          <div className="eq-row">
            <TextField label="Width" value={width} onChange={setWidth} placeholder="0" suffix="ft" type="number" />
            <TextField label="Height" value={height} onChange={setHeight} placeholder="0" suffix="ft" type="number" />
          </div>
          <TextField label="Number of axles" value={axles} onChange={setAxles} placeholder="0" type="number" />
          {type === 'Reefer' && (
            <div className="eq-row">
              <TextField label="Min Temperature" value={minTemp} onChange={setMinTemp} placeholder="Min temperature" suffix="°F" type="number" />
              <TextField label="Max Temperature" value={maxTemp} onChange={setMaxTemp} placeholder="Max temperature" suffix="°F" type="number" />
            </div>
          )}
          <Footer
            secondary="Back"
            onSecondary={() => setStep(1)}
            primary="Finish"
            disabled={false}
            onPrimary={() =>
              onAdd({
                name: name.trim(),
                type,
                plate: plate.trim() || undefined,
                weightCapacity: num(weight),
                length: num(length),
                width: num(width),
                height: num(height),
                axles: num(axles),
                minTemp: type === 'Reefer' ? num(minTemp) : undefined,
                maxTemp: type === 'Reefer' ? num(maxTemp) : undefined,
              })
            }
          />
        </>
      )}
    </>
  )
}

// ── Add new team member (driver) ──
export function AddDriverForm({
  takenEmails,
  onCancel,
  onAdd,
}: {
  takenEmails: string[]
  onCancel: () => void
  onAdd: (driver: { email: string; eldId?: string }) => void
}) {
  const [email, setEmail] = useState('')
  const [eldId, setEldId] = useState('')
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const duplicate = takenEmails.includes(email.trim().toLowerCase())

  return (
    <>
      <FormHead icon={<UserPlus size={16} />} title="Add new team member" />
      <TextField label="Email" value={email} onChange={setEmail} placeholder="Write the email address" type="email" required autoFocus />
      {duplicate && <span className="eq-error">This driver was already added.</span>}
      <SelectField label="Role" value="Driver" onChange={() => {}} options={['Driver']} placeholder="Driver" required disabled />
      <TextField label="Driver ID" value={eldId} onChange={setEldId} placeholder="Enter the Driver ELD ID" />
      <p className="eq-note">
        We&apos;ll send an invitation to this email. Once the user creates an account, you can set their access
        permissions.
      </p>
      <Footer
        secondary="Cancel"
        onSecondary={onCancel}
        primary="Send invitation"
        disabled={!valid || duplicate}
        onPrimary={() => onAdd({ email: email.trim().toLowerCase(), eldId: eldId.trim() || undefined })}
      />
    </>
  )
}
