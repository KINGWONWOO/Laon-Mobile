import LegalScreen from '../../components/ui/LegalScreen';
import { privacyPolicy } from '../../constants/legalContent';
import { useAppContext } from '../../context/AppContext';

export default function PrivacyPolicyScreen() {
  const { language } = useAppContext();
  return <LegalScreen doc={privacyPolicy[language]} />;
}
