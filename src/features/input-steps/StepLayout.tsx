import { useInputStore } from '../../store/inputStore';
import { RoughFlow } from './rough/RoughFlow';
import { ThoroughFlow } from './thorough/ThoroughFlow';

// 入力フローのルーター。ざっくり診断 / しっかり診断 をモードで切り替える。
export function StepLayout() {
  const mode = useInputStore((s) => s.mode);
  if (mode === 'thorough') return <ThoroughFlow />;
  return <RoughFlow />;
}
