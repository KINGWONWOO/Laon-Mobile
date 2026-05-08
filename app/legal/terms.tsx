import LegalScreen from '../../components/ui/LegalScreen';
import { termsOfService } from '../../constants/legalContent';
import { useAppContext } from '../../context/AppContext';

export default function TermsOfServiceScreen() {
  const { language } = useAppContext();
  return <LegalScreen doc={termsOfService[language]} />;
}
