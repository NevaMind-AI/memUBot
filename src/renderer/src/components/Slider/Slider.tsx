interface SliderProps {
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
}

export function Slider({ min, max, step, value, onChange }: SliderProps): JSX.Element {
  // Calculate the percentage of the current value
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="slider-input w-full h-1 rounded-full cursor-pointer appearance-none"
      style={{
        background: `linear-gradient(to right, #2596D1 ${percentage}%, #e2e8f0 ${percentage}%)`
      }}
    />
  )
}
