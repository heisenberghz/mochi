import { DenApp } from './den/DenApp';
import { PetApp } from './pet/PetApp';
import './den/den.css';
import './pet/pet.css';

export function App() {
  const surface = new URLSearchParams(window.location.search).get('surface');
  return surface === 'den' ? <DenApp /> : <PetApp />;
}
