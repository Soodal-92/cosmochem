import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(url, key);

export async function saveCompound({ name, smiles, result }) {
  const { data, error } = await supabase.from('compounds').insert({
    name:        name || null,
    smiles,
    formula:     result.formula,
    mw:          result.mw,
    exact_mass:  result.exact_mass,
    logp:        result.logp,
    tpsa:        result.tpsa,
    hbd:         result.hbd,
    hba:         result.hba,
    rot_bonds:   result.rot_bonds,
    heavy_atoms: result.heavy_atoms,
    rings:       result.rings,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getCompounds() {
  const { data, error } = await supabase
    .from('compounds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data;
}

export async function saveDoeExperiment({ name, designResult, yValues, regrResult }) {
  const { data, error } = await supabase.from('doe_experiments').insert({
    name:              name || null,
    design_type:       designResult.design,
    factors:           designResult.factor_names,
    runs:              designResult.runs,
    coded:             designResult.coded,
    n_runs:            designResult.n_runs,
    y_values:          yValues,
    regression_result: regrResult || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getDoeExperiments() {
  const { data, error } = await supabase
    .from('doe_experiments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data;
}
