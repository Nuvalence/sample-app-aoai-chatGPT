import { Outlet } from "react-router-dom";
import { CopyRegular } from "@fluentui/react-icons";
import { Dialog, Stack, TextField } from "@fluentui/react";
import { useEffect, useState } from "react";

import styles from "./Layout.module.css";

import LogoWording from "../../assets/LogoWording.svg";
import SearchProfile from "../../assets/SearchProfile.svg";
import LanguageSelect from "../../assets/LanguageSelect.svg";

const Layout = () => {
    const [isSharePanelOpen, setIsSharePanelOpen] = useState<boolean>(false);
    const [copyClicked, setCopyClicked] = useState<boolean>(false);
    const [copyText, setCopyText] = useState<string>("Copy URL");
    const businessPage = "https://nyc-business.nyc.gov/nycbusiness/";

    const handleShareClick = () => {
        setIsSharePanelOpen(true);
    };

    const handleSharePanelDismiss = () => {
        setIsSharePanelOpen(false);
        setCopyClicked(false);
        setCopyText("Copy URL");
    };

    const handleCopyClick = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopyClicked(true);
    };

    const navToBusinessPage = () => {
        window.open(businessPage ?? "", "_blank")?.focus();
    }

    useEffect(() => {
        if (copyClicked) {
            setCopyText("Copied URL");
        }
    }, [copyClicked]);

    return (
        <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
                <div>
                    <div className={styles.logoBar}>
                        <img
                            src={LogoWording}
                            className={styles.nycLogo}
                            aria-hidden="true"
                        />
                    </div>
                    <div className={styles.navBar}>
                        <div className={styles.navTitle}
                        onClick={navToBusinessPage}
                        >Business</div>
                        <div className={styles.navButtons}>
                            <span>Resources by Business</span>
                            <span>Business Services</span>
                            <span>Emergency Preparedness</span>
                            <span>Regulations</span>
                            <span>Tools</span>
                            <span>My Business Dashboard</span>
                            <span>
                                <img
                                    src={SearchProfile}
                                    aria-hidden="true"
                                />
                            </span>
                        </div>
                    </div>
                    <div className={styles.languageBar}>
                        <img
                            className={styles.languageSelect}
                            src={LanguageSelect}
                            aria-hidden="true"
                        />
                    </div>
                </div>
            </header>
            <Outlet />
            <Dialog 
                onDismiss={handleSharePanelDismiss}
                hidden={!isSharePanelOpen}
                styles={{
                    
                    main: [{
                        selectors: {
                          ['@media (min-width: 480px)']: {
                            maxWidth: '600px',
                            background: "#FFFFFF",
                            boxShadow: "0px 14px 28.8px rgba(0, 0, 0, 0.24), 0px 0px 8px rgba(0, 0, 0, 0.2)",
                            borderRadius: "8px",
                            maxHeight: '200px',
                            minHeight: '100px',
                          }
                        }
                      }]
                }}
                dialogContentProps={{
                    title: "Share the web app",
                    showCloseButton: true
                }}
            >
                <Stack horizontal verticalAlign="center" style={{gap: "8px"}}>
                    <TextField className={styles.urlTextBox} defaultValue={window.location.href} readOnly/>
                    <div 
                        className={styles.copyButtonContainer} 
                        role="button" 
                        tabIndex={0} 
                        aria-label="Copy" 
                        onClick={handleCopyClick}
                        onKeyDown={e => e.key === "Enter" || e.key === " " ? handleCopyClick() : null}
                    >
                        <CopyRegular className={styles.copyButton} />
                        <span className={styles.copyButtonText}>{copyText}</span>
                    </div>
                </Stack>
            </Dialog>
            <footer>
                <div className={styles.footerContainer}>
                    <div className={styles.copyright}>
                        <span>&copy; 2023 City of New York. All Rights Reserved.</span>
                    </div>
                    <div className={styles.links}>
                        <span>Give Feedback</span>
                        <span>Terms of Use</span>
                        <span>Privacy Policy</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
