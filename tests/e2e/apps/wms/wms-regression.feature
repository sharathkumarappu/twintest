Feature: WMS Regression

    Scenario: Create a Fresh Order with Shipment and Departure, release the Customer Order from OMLM via DB queries
        * Generate random Order number
        * Update context variables
            | DELIVERYDATETIME        | tomorrow            |
            | OPCO_COUNTRYCODE        | NL                  |
            | DELIVERYSTREAMNO        | 2                   |
            | DELIVERERNO             | 2                   |
            | SUPPLYMETHOD            | NULL                |
            | MESG_ACTION             | I                   |
            | MESG_SOURCESERVICETYPE  | TEST                |
            | MESG_INSERTEDDATETIME   | now                 |
            | MESG_IND_COMPLETED      | N                   |
            | MESG_PROCESSEDDATETIME  | NULL                |
            | MESG_IND_PROCESSED      | N                   |
            | MESG_EVENT_DATETIME     | now                 |
            | MESSAGECREATIONDATETIME | now                 |
            | STOREORDERNO            | CONTEXT-orderNumber |
            | MESG_SO_LINE_T_SEQ_NO   | 1                   |
        * Run query select ahgs_utility.get_parameter_n('WAREHOUSENO', 'AHGS')from dual and store single result to WAREHOUSENO
        * Run query select ahgs_utility.get_parameter_n('WAREHOUSEGLN', 'AHGS')from dual and store single result to WAREHOUSEGLN
        * Run query select ahgs_utility.get_parameter_n('OPCO_GLN', 'AHGS')from dual and store single result to OPCO_GLN
        * Run query select message_t_seq.nextval from dual and store single result to MESG_SEQ_NO
        * Run query select PARTY_ID, GEOREF from (select * from PARTY where PARTY_QUALIFIER='CU' order by DBMS_RANDOM.RANDOM) where rownum<2 and store results to queryResults
        * Extract column PARTY_ID from queryResults and store to STORENO
        * Extract column GEOREF from queryResults and store to DESTINATIONLOCATIONGLN
        * Run insert query on MSG_2080_STORE_ORDER_V5_T table with context variables
            | MESG_SEQ_NO | OPCO_GLN | OPCO_COUNTRYCODE | STORENO | WAREHOUSENO | WAREHOUSEGLN | DELIVERYSTREAMNO | DELIVERYDATETIME | DELIVERERNO | SUPPLYMETHOD | MESG_ACTION | MESG_SOURCESERVICETYPE | MESG_INSERTEDDATETIME | MESG_IND_COMPLETED | MESG_PROCESSEDDATETIME | MESG_IND_PROCESSED | MESG_EVENT_DATETIME | MESSAGECREATIONDATETIME | STOREORDERNO |
        * Run query SELECT PROD_ID FROM (SELECT omlm_package_stock.PROD_ID, art.arttrptypid FROM omlm_package_stock JOIN art ON omlm_package_stock.PROD_ID = art.ARTID WHERE omlm_package_stock.PROD_ID IN (SELECT PROD_ID FROM omlm_package_stock GROUP BY PROD_ID HAVING COUNT(*) = 1) AND omlm_package_stock.NUMBER_OF_PACKAGES >= 200 AND omlm_package_stock.PROMOTION_FLAG = 'N' AND art.arttrptypid = '1' ORDER BY DBMS_RANDOM.VALUE) WHERE ROWNUM = 1 and store single result to SOINO
        * Update context variables
            | QUANTITY            | 3             |
            | ORDERLINEID         | 1             |
            | PROMOTIONIND        | Y             |
            | INITIALPROMOTIONIND | N             |
            | ADDUNORDEREDIND     | N             |
            | EMERGENCYORDERIND   | N             |
            | SUPPLIERCOMPANYGLN  | 4008596000004 |
            | SUPPLIERNO          | 626952        |
        * Run insert query on MSG_2080_STORE_ORDLINE_V5_T table with context variables
            | MESG_SEQ_NO | MESG_SO_LINE_T_SEQ_NO | SOINO | QUANTITY | ORDERLINEID | PROMOTIONIND | INITIALPROMOTIONIND | ADDUNORDEREDIND | EMERGENCYORDERIND | SUPPLIERCOMPANYGLN | SUPPLIERNO |
        * Run modification query update MSG_2080_STORE_ORDER_v5_T set mesg_ind_completed = 'Y' where 1=1 and MESG_SOURCESERVICETYPE = 'TEST' and mesg_ind_completed = 'N' and mesg_processeddatetime is null
        * Verify that order with number CONTEXT-STOREORDERNO and message number CONTEXT-MESG_SEQ_NO is created in omlm_store_order
        * Update context variables
            | TESTINDICATOR   | N             |
            | CARRIERPARTYID  | 80            |
            | CARRIERPARTYGLN | 8718906726802 |
            | EQUIPMENTTYPE   | ED01_5461     |
            | ENDDATETIME     | today+2 days  |
            | COMMODITY       | FRESH         |
            | AFLS_NUMBER     | 2             |
            | STATUS          | FINAL         |
        * Generate random Batch number
        * Generate random Message number
        * Generate random Shipment number
        * Run insert query on MSG_2589_SHIPMENT_T table with context variables
            | MESG_SEQ_NO | MESSAGENO | TESTINDICATOR | OPCO_GLN | OPCO_COUNTRYCODE | SHIPMENTID | CARRIERPARTYID | CARRIERPARTYGLN | EQUIPMENTTYPE | ENDDATETIME | COMMODITY | MESG_ACTION | MESG_SOURCESERVICETYPE | MESG_INSERTEDDATETIME | MESG_IND_COMPLETED | MESG_PROCESSEDDATETIME | MESG_IND_PROCESSED | MESG_EVENT_DATETIME | MESSAGECREATIONDATETIME | STATUS | BATCHNUMBER |
        * Run query SELECT dockid, shipwpadr FROM deptrp WHERE shipwsid = 'vs1' AND arttrptypid = '1' ORDER BY UPDDTM DESC FETCH FIRST 1 ROW ONLY and store results to queryResults
        * Extract column DOCKID from queryResults and store to DOCK
        * Extract column SHIPWPADR from queryResults and store to SHIPPINGSTAGELOCATION
        * Update context variables
            | LOCATIONWAREHOUSENO            | CONTEXT-WAREHOUSENO  |
            | LOCATIONGLN                    | CONTEXT-WAREHOUSEGLN |
            | EARLIESTTIMEONSHIPPINGLOCATION | now+4 hours          |
            | ARRIVALDATETIME                | tomorrow             |
            | DEPARTUREDATETIME              | tomorrow-4 hours     |
            | STARTLOADDATETIME              | tomorrow-280 minutes |
            | FINISHLOADDATETIME             | tomorrow-260 minutes |
        * Run insert query on MSG_2589_SHIPMENT_FROMSTOP_T table with context variables
            | MESG_SEQ_NO | LOCATIONWAREHOUSENO | LOCATIONGLN | DOCK | EARLIESTTIMEONSHIPPINGLOCATION | ARRIVALDATETIME | DEPARTUREDATETIME | STARTLOADDATETIME | FINISHLOADDATETIME |
        * Update context variables
            | PLANNEDARRIVALMOMENT   | tomorrow+2 hours |
            | PLANNEDDEPARTUREMOMENT | tomorrow+3 hours |
        * Run insert query on MSG_2589_SHIPMENT_RETURNSTOP_T table with context variables
            | MESG_SEQ_NO | LOCATIONGLN | PLANNEDARRIVALMOMENT | PLANNEDDEPARTUREMOMENT |
        * Update context variables
            | MESG_TOSTOP_SEQ_NO     | 1                              |
            | DESTINATIONLOCATIONGLN | CONTEXT-DESTINATIONLOCATIONGLN |
            | PLANNEDDELIVERYMOMENT  | tomorrow                       |
            | LOADSEQUENCENUMBER     | 1                              |
            | LATESTDELIVERYDATETIME | tomorrow+30 minutes            |
            | PLANNEDARRIVALMOMENT   | tomorrow-30 minutes            |
        * Run insert query on MSG_2589_SHIPMENT_TOSTOP_T table with context variables
            | MESG_SEQ_NO | MESG_TOSTOP_SEQ_NO | DESTINATIONLOCATIONGLN | PLANNEDDELIVERYMOMENT | LOADSEQUENCENUMBER | LATESTDELIVERYDATETIME | PLANNEDDEPARTUREMOMENT | SHIPPINGSTAGELOCATION |
        * Update context variables
            | MESG_ORDER_SEQ_NO     | 1                    |
            | THUEQUIVALENTCOUNT    | 15                   |
            | SOURCELOCATIONGLN     | CONTEXT-WAREHOUSEGLN |
            | SHIPMENTORDERSTOPTYPE | O                    |
        * Run insert query on MSG_2589_SHIPMENT_ORDER_T table with context variables
            | MESG_SEQ_NO | MESG_TOSTOP_SEQ_NO | MESG_ORDER_SEQ_NO | STOREORDERNO | THUEQUIVALENTCOUNT | SOURCELOCATIONGLN | SHIPMENTORDERSTOPTYPE | LATESTDELIVERYDATETIME | COMMODITY |
        * Run modification query update MSG_2589_SHIPMENT_T set mesg_ind_completed = 'Y' where 1=1 and MESG_SOURCESERVICETYPE = 'TEST' and mesg_ind_completed = 'N' and mesg_processeddatetime is null
        * Update context variables
            | ROUTE_ID | CONTEXT-SHIPMENTID |
        * Wait 5 seconds
        * Verify that order with route ID CONTEXT-SHIPMENTID is created in RMUSER.DEP
        * Wait 60 seconds
        * Run query select * from OMLM_DEPARTURE where ROUTE_ID = 'CONTEXT-ROUTE_ID' and store results to selectQueryResults
        * Extract column DEPARTURE_ID from selectQueryResults and store to DEPARTURE_ID
        * Wait for a maximum of 120 seconds for SRIT_DEPARTURE_ID to be populated in the IRMS_HLP_SCHED_DISTR_TRIP table for the SRIT_DEPARTURE_ID column having value CONTEXT-DEPARTURE_ID
        * Wait for a maximum of 120 seconds for DEPLOAD_ID to be populated in the OMLM_DEPARTURE_LOAD table for the SRIT_DEPARTURE_ID column having value CONTEXT-DEPARTURE_ID
        * Update context LATEST_TIME_ON_STRECK -> now+1 hours
        * Run update query on OMLM_DEPARTURE table with context variables
            | SET   | LATEST_TIME_ON_STRECK |
            | WHERE | DEPARTURE_ID          |
        * Wait 10 seconds
        * Run OMLM batch job to start batch
        * Wait 180 seconds
        * Run query select * from CO where COID = 'CONTEXT-STOREORDERNO' and store results to orderDetails
        * If no entries were found in orderDetails wait until the next quarter hour window for the OML batch job to run and rerun the query select * from CO where COID = 'CONTEXT-STOREORDERNO'
        * Extract column COSTATID from orderDetails and store to OrderStatus
        * Assert that value of CONTEXT-OrderStatus equals 20