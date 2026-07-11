import { useProfile } from '../hooks/useProfile';
import { AboutMeIntake } from '../components/profile/AboutMeIntake';
import { ValuesSection } from '../components/profile/ValuesSection';
import { ConcernsSection } from '../components/profile/ConcernsSection';
import { EducationTopicsSection } from '../components/profile/EducationTopicsSection';
import { DeleteAccountSection } from '../components/profile/DeleteAccountSection';
import { TextSizeControl } from '../components/layout/TextSizeControl';

export function ProfilePage() {
  const { profile, isLoading, updateAboutMe, isSaving } = useProfile();

  return (
    <div className="profile-page">
      <h1>About Me</h1>

      <section className="profile-detail-section" aria-labelledby="display-settings-heading">
        <h2 id="display-settings-heading">Display settings</h2>
        <p className="section-intro">Adjust the text size to whatever's comfortable for you.</p>
        <TextSizeControl />
      </section>

      {isLoading ? (
        <p>Loading your profile...</p>
      ) : (
        <AboutMeIntake aboutMe={profile?.aboutMe} onSave={updateAboutMe} isSaving={isSaving} />
      )}
      <ValuesSection />
      <ConcernsSection />
      <EducationTopicsSection />
      <DeleteAccountSection />
    </div>
  );
}
