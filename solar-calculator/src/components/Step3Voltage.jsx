const Step3Voltage = ({ data, onChange }) => {
  // Comprehensive inverter voltage settings based on research
  const voltageOptions = [
    // 12V System Voltages
    { value: '12_bulk', label: '12V - Bulk', voltage: 14.4, description: 'Lead Acid Bulk' },
    { value: '12_absorption', label: '12V - Absorption', voltage: 14.6, description: 'Lead Acid Absorption' },
    { value: '12_float', label: '12V - Float', voltage: 13.5, description: 'Float Voltage' },
    { value: '12_cutoff', label: '12V - Cutoff/LVD', voltage: 10.5, description: 'Low Voltage Cutoff' },
    { value: '12_lvd_restart', label: '12V - LVD Restart', voltage: 12.0, description: 'Low Voltage Restart' },
    { value: '12_eco', label: '12V - ECO Mode', voltage: 11.5, description: 'Economy Mode Cutoff' },
    { value: '12_lithium_full', label: '12V - LiFePO4 Full', voltage: 14.6, description: 'Lithium Full Charge' },
    { value: '12_lithium_cutoff', label: '12V - LiFePO4 Cutoff', voltage: 11.0, description: 'Lithium Low Cutoff' },
    
    // 24V System Voltages
    { value: '24_bulk', label: '24V - Bulk', voltage: 28.8, description: 'Lead Acid Bulk' },
    { value: '24_absorption', label: '24V - Absorption', voltage: 29.2, description: 'Lead Acid Absorption' },
    { value: '24_float', label: '24V - Float', voltage: 27.0, description: 'Float Voltage' },
    { value: '24_cutoff', label: '24V - Cutoff/LVD', voltage: 21.0, description: 'Low Voltage Cutoff' },
    { value: '24_lvd_restart', label: '24V - LVD Restart', voltage: 24.0, description: 'Low Voltage Restart' },
    { value: '24_eco', label: '24V - ECO Mode', voltage: 23.0, description: 'Economy Mode Cutoff' },
    { value: '24_lithium_full', label: '24V - LiFePO4 Full', voltage: 29.2, description: 'Lithium Full Charge' },
    { value: '24_lithium_cutoff', label: '24V - LiFePO4 Cutoff', voltage: 22.0, description: 'Lithium Low Cutoff' },
    
    // 48V System Voltages
    { value: '48_bulk', label: '48V - Bulk', voltage: 57.6, description: 'Lead Acid Bulk' },
    { value: '48_absorption', label: '48V - Absorption', voltage: 58.4, description: 'Lead Acid Absorption' },
    { value: '48_float', label: '48V - Float', voltage: 54.0, description: 'Float Voltage' },
    { value: '48_cutoff', label: '48V - Cutoff/LVD', voltage: 42.0, description: 'Low Voltage Cutoff' },
    { value: '48_lvd_restart', label: '48V - LVD Restart', voltage: 48.0, description: 'Low Voltage Restart' },
    { value: '48_eco', label: '48V - ECO Mode', voltage: 46.0, description: 'Economy Mode Cutoff' },
    { value: '48_lithium_full', label: '48V - LiFePO4 Full', voltage: 58.4, description: 'Lithium Full Charge' },
    { value: '48_lithium_cutoff', label: '48V - LiFePO4 Cutoff', voltage: 44.0, description: 'Lithium Low Cutoff' },
    { value: '48BMS_cutoff', label: '48V - BMS Cutoff', voltage: 40.0, description: 'BMS Low Voltage Protection' },
    { value: '48BMS_over', label: '48V - BMS Overvoltage', voltage: 50.5, description: 'BMS Over Voltage Protection' },
    { value: '48_absorption_alt', label: '48V - Absorption Alt', voltage: 49.9, description: 'Alternative Absorption' },
    { value: '48_float_alt', label: '48V - Float Alt', voltage: 49.8, description: 'Alternative Float' },
    
    // 96V System Voltages (Large Systems)
    { value: '96_bulk', label: '96V - Bulk', voltage: 115.2, description: 'Lead Acid Bulk' },
    { value: '96_float', label: '96V - Float', voltage: 108.0, description: 'Float Voltage' },
    { value: '96_cutoff', label: '96V - Cutoff/LVD', voltage: 84.0, description: 'Low Voltage Cutoff' },
  ];

  return (
    <div className="step-content">
      <h2>Step 2: Inverter Switching Voltage</h2>
      <p className="step-description">Select your inverter voltage settings based on your battery system</p>
      
      <div className="form-group">
        <label htmlFor="inverter_voltage">Inverter Voltage Setting</label>
        <select
          id="inverter_voltage"
          name="inverter_voltage"
          value={data.inverter_voltage || ''}
          onChange={(e) => onChange({ inverter_voltage: e.target.value })}
          autoFocus
        >
          <option value="">Select voltage setting...</option>
          <optgroup label="12V System">
            {voltageOptions.filter(v => v.value.startsWith('12_')).map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.voltage}V) - {opt.description}
              </option>
            ))}
          </optgroup>
          <optgroup label="24V System">
            {voltageOptions.filter(v => v.value.startsWith('24_')).map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.voltage}V) - {opt.description}
              </option>
            ))}
          </optgroup>
          <optgroup label="48V System">
            {voltageOptions.filter(v => v.value.startsWith('48_')).map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.voltage}V) - {opt.description}
              </option>
            ))}
          </optgroup>
          <optgroup label="96V System (Large)">
            {voltageOptions.filter(v => v.value.startsWith('96_')).map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.voltage}V) - {opt.description}
              </option>
            ))}
          </optgroup>
        </select>
        <span className="hint">Choose based on your battery type and system configuration. Values vary by battery chemistry (Lead Acid vs Lithium)</span>
      </div>

      {/* Voltage Reference Guide */}
      <div className="form-group" style={{ marginTop: '20px' }}>
        <label>Quick Reference Guide</label>
        <div style={{ fontSize: '0.85rem', color: '#666', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '8px' }}><strong>Lead Acid:</strong> Bulk 14.4V (12V) / 28.8V (24V) / 57.6V (48V)</p>
          <p style={{ marginBottom: '8px' }}><strong>Float:</strong> 13.5V (12V) / 27.0V (24V) / 54.0V (48V)</p>
          <p style={{ marginBottom: '8px' }}><strong>Lithium (LiFePO4):</strong> Full 14.6V / Cutoff 11.0V (12V)</p>
          <p style={{ marginBottom: '8px' }}><strong>Low Voltage Disconnect:</strong> 10.5V (12V) / 21.0V (24V) / 42.0V (48V)</p>
          <p><strong>LVD Restart:</strong> Should be ~1V higher than cutoff to prevent rapid fluctuation</p>
        </div>
      </div>
    </div>
  );
};

export default Step3Voltage;