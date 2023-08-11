import { useState } from "react";
import { Card } from "semantic-ui-react";
import styles from "./InfoCard.module.css";
import 'semantic-ui-css/semantic.min.css';

export interface IInfoCard {
    title: string;
    icon?: string;
    details: Detail[];
    onSendQuestion?: (question: string) => void;
    isFirstCard?: boolean;
}

interface Detail {
    info: string;
    icon?: string;
    emitQuestion?: boolean;
}

export const InfoCard = ({ title, icon, details, onSendQuestion, isFirstCard }: IInfoCard) => {
    const [question, setQuestion] = useState<string>("");

    const handleDetailClick = (detail: Detail) => {
        if (typeof onSendQuestion !== 'function' || !detail.emitQuestion) {
            return;
        }
        setQuestion(detail.info);
        onSendQuestion(detail.info);

    };

    return (
        <Card className={styles.cardContainer} style={{ marginTop: 'unset', height: '100%'}}>
            <Card.Content>
                <Card.Header className={`${styles.cardHeader} ${isFirstCard ? styles.firstCardHeader : ''}`}>
                    <div className={styles.cardHeaderIcon}>
                        {icon && <img src={icon} alt="Icon"/>}
                    </div>
                    <div className={styles.cardHeaderTitle}>{title}</div>
                </Card.Header>
                <Card.Description>
                    {details.map((detail, index) => (
                        <div 
                        key={index} 
                        className={`${styles.cardDescription} ${isFirstCard ? styles.firstCardDetails : ''}`}
                        onClick={() => handleDetailClick(detail)}
                        >
                            <div>
                                <span>{detail.info}</span>
                            </div>
                            <div>
                                {detail.icon && <img className={styles.descriptionImage} src={detail.icon} alt="Icon"/>}
                            </div>

                        </div>
                    ))}
                </Card.Description>
            </Card.Content>
        </Card>
    )
};

export default InfoCard;
