-- Token/item tirado da tela pelo "Remover" continua na biblioteca da cena
ALTER TABLE "Token" ADD COLUMN "isOnMap" BOOLEAN NOT NULL DEFAULT true;
